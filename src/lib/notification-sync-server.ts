import { createHash } from "node:crypto";
import { db } from "@/lib/db";
import { batchReadDbMetadata, getTvSeasonDetail, getTvStatusMetadata, type TvStatusMetadata } from "@/lib/tv-status-server";
import { isEpisodeReleased } from "@/lib/tv-status-engine";
import {
  formatAirDate,
  isSeasonFinale,
  isSeasonPremiere,
  isUpcomingSeasonAlert,
  scheduledAirDate,
} from "@/lib/notification-schedule";
import {
  backlogBody,
  canReconcileEpisodeBacklog,
  parseBacklogCount,
  releasedEpisodeDelta,
  shouldWakeBacklog,
} from "@/lib/notification-sync-policy";
import { sendPushToUser } from "@/lib/web-push-server";

const DAILY_EPISODE_TYPES = ["new_episode", "backlog_alert"];
const SEASON_EVENT_TYPES = ["season_premiere", "season_finale"];
const SERIES_NOTIFICATION_TYPES = [...DAILY_EPISODE_TYPES, "season_return", ...SEASON_EVENT_TYPES];
const REFRESH_CONCURRENCY = 8;
const ONGOING_NOTIFICATION_REFRESH_MS = 60 * 60 * 1000;
const ENDED_NOTIFICATION_REFRESH_MS = 6 * 24 * 60 * 60 * 1000;

type TrackedShow = { tmdbId: number; title: string };
type PushEvent = { title: string; body: string; tmdbId: number };

function notificationId(key: string): string {
  return `notif_${createHash("sha256").update(key).digest("hex").slice(0, 32)}`;
}

function seasonEventKey(type: string, tmdbId: number, airDate: string): string {
  return `${type}:${tmdbId}:${airDate}`;
}

async function mapLimit<T, R>(items: T[], limit: number, worker: (item: T) => Promise<R>): Promise<R[]> {
  const results = new Array<R>(items.length);
  let cursor = 0;
  async function run() {
    while (true) {
      const index = cursor++;
      if (index >= items.length) return;
      results[index] = await worker(items[index]);
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, run));
  return results;
}

async function freshMetadata(ids: number[], now: Date, refreshEnded = false) {
  const [before, cacheRows] = await Promise.all([
    batchReadDbMetadata(ids, now, { includeEpisodeKeys: true, allowStale: true }),
    db.tvMetadataCache.findMany({
      where: { tmdbId: { in: ids } },
      select: {
        tmdbId: true,
        officiallyEnded: true,
        fetchedAt: true,
        nextEpisodeAirDate: true,
      },
    }),
  ]);
  const cacheById = new Map(cacheRows.map((row) => [row.tmdbId, row]));
  const ongoingCutoff = new Date(now.getTime() - ONGOING_NOTIFICATION_REFRESH_MS);
  const endedCutoff = new Date(now.getTime() - ENDED_NOTIFICATION_REFRESH_MS);
  const refreshIds = ids.filter((id) => {
    const row = cacheById.get(id);
    if (!row || !before.has(id)) return true;
    if (row.officiallyEnded) return refreshEnded && row.fetchedAt <= endedCutoff;
    if (row.nextEpisodeAirDate && isEpisodeReleased(row.nextEpisodeAirDate, now)) return true;
    return row.fetchedAt <= ongoingCutoff;
  });
  const current = new Map(before);
  const refreshed = await mapLimit(refreshIds, REFRESH_CONCURRENCY, async (id) => {
    try {
      return await getTvStatusMetadata(id, now);
    } catch (error) {
      console.warn("[notifications] metadata refresh failed", id, error);
      return null;
    }
  });
  for (const metadata of refreshed) if (metadata) current.set(metadata.tmdbId, metadata);
  return {
    before,
    fresh: current,
    refreshed: refreshed.filter(Boolean).length,
    failed: refreshed.filter((row) => !row).length,
  };
}

async function syncBacklogNotifications(
  userId: string,
  shows: TrackedShow[],
  metadata: Map<number, TvStatusMetadata>,
  previousMetadata: Map<number, TvStatusMetadata>,
  watchedKeys: Set<string>,
  now: Date,
): Promise<{ changed: number; pushEvents: PushEvent[] }> {
  const ids = shows.map((show) => show.tmdbId);
  const existing = await db.notification.findMany({
    where: { userId, type: { in: DAILY_EPISODE_TYPES }, tmdbId: { in: ids } },
    orderBy: { createdAt: "desc" },
  });
  const rowsByShow = new Map<number, typeof existing>();
  for (const row of existing) {
    if (row.tmdbId == null) continue;
    const rows = rowsByShow.get(row.tmdbId) ?? [];
    rows.push(row);
    rowsByShow.set(row.tmdbId, rows);
  }

  let changed = 0;
  const pushEvents: PushEvent[] = [];
  for (const show of shows) {
    const current = metadata.get(show.tmdbId);
    // An incomplete TMDB boundary must never erase a previously valid alert.
    if (!canReconcileEpisodeBacklog(current)) continue;
    const missing = [...current.airedEpisodeKeys].filter((key) => !watchedKeys.has(`${show.tmdbId}:${key}`));
    const rows = rowsByShow.get(show.tmdbId) ?? [];
    const keeper = rows[0] ?? null;
    if (rows.length > 1) {
      const removed = await db.notification.deleteMany({ where: { id: { in: rows.slice(1).map((row) => row.id) } } });
      changed += removed.count;
    }

    if (missing.length === 0) {
      if (keeper) {
        const removed = await db.notification.deleteMany({ where: { id: keeper.id, userId } });
        changed += removed.count;
      }
      continue;
    }

    const type = missing.length === 1 ? "new_episode" : "backlog_alert";
    const body = backlogBody(missing.length);
    const oldCount = keeper ? parseBacklogCount(keeper.type, keeper.body) : 0;
    const newlyReleased = releasedEpisodeDelta(previousMetadata.get(show.tmdbId), current);
    const shouldWake = shouldWakeBacklog({
      hasExisting: Boolean(keeper),
      previousMissingCount: oldCount,
      missingCount: missing.length,
      newlyReleasedCount: newlyReleased,
    });
    let wakeClaimed = false;

    if (keeper) {
      const textChanged = keeper.type !== type || keeper.title !== show.title || keeper.body !== body || keeper.mediaType !== "tv";
      if (textChanged || shouldWake) {
        const wakeCreatedAt = new Date(Math.max(now.getTime(), keeper.createdAt.getTime() + 1));
        const updated = await db.notification.updateMany({
          // createdAt acts as an optimistic claim: only one overlapping sync
          // can re-awaken this row and send its corresponding push event.
          where: { id: keeper.id, userId, createdAt: keeper.createdAt },
          data: {
            type,
            title: show.title,
            body,
            mediaType: "tv",
            ...(shouldWake ? { read: false, createdAt: wakeCreatedAt } : {}),
          },
        });
        changed += updated.count;
        wakeClaimed = shouldWake && updated.count === 1;
      }
    } else {
      const id = notificationId(`${userId}:series-backlog:${show.tmdbId}`);
      const inserted = await db.notification.createMany({
        data: [{
          id,
          userId,
          type,
          title: show.title,
          body,
          tmdbId: show.tmdbId,
          mediaType: "tv",
          read: false,
          createdAt: now,
        }],
        skipDuplicates: true,
      });
      changed += inserted.count;
      wakeClaimed = inserted.count === 1;
    }

    if (wakeClaimed) pushEvents.push({ title: show.title, body, tmdbId: show.tmdbId });
  }
  return { changed, pushEvents };
}

async function syncSeasonEvents(userId: string, timezone: string, shows: TrackedShow[], metadataById: Map<number, TvStatusMetadata>, now: Date) {
  const ids = shows.map((show) => show.tmdbId);
  const existing = await db.notification.findMany({
    where: { userId, tmdbId: { in: ids }, type: { in: SEASON_EVENT_TYPES } },
    select: { type: true, tmdbId: true, scheduledFor: true },
  });
  const existingKeys = new Set(existing
    .filter((item) => item.tmdbId != null && item.scheduledFor)
    .map((item) => seasonEventKey(item.type, item.tmdbId!, item.scheduledFor!.toISOString().slice(0, 10))));

  const upcoming = shows.flatMap((show) => {
    const episode = metadataById.get(show.tmdbId)?.nextEpisode;
    return isUpcomingSeasonAlert(episode, now, timezone) ? [{ show, episode }] : [];
  });
  const seasonDetails = new Map<string, Awaited<ReturnType<typeof getTvSeasonDetail>> | null>();
  await mapLimit(upcoming.filter(({ episode }) => !isSeasonPremiere(episode)), 4, async ({ show, episode }) => {
    const key = `${show.tmdbId}:${episode.seasonNumber}`;
    if (seasonDetails.has(key)) return null;
    try {
      seasonDetails.set(key, await getTvSeasonDetail(show.tmdbId, episode.seasonNumber));
    } catch {
      seasonDetails.set(key, null);
    }
    return null;
  });

  const pushEvents: PushEvent[] = [];
  let created = 0;
  for (const { show, episode } of upcoming) {
    let type: "season_premiere" | "season_finale" | null = null;
    if (isSeasonPremiere(episode)) type = "season_premiere";
    else {
      const season = seasonDetails.get(`${show.tmdbId}:${episode.seasonNumber}`);
      if (season && isSeasonFinale(episode, season.episodes ?? [])) type = "season_finale";
    }
    if (!type) continue;
    const key = seasonEventKey(type, show.tmdbId, episode.airDate);
    if (existingKeys.has(key)) continue;
    const body = type === "season_premiere"
      ? `يبدأ الموسم ${episode.seasonNumber} في ${formatAirDate(episode.airDate, timezone)}.`
      : `تُعرض الحلقة النهائية للموسم ${episode.seasonNumber} في ${formatAirDate(episode.airDate, timezone)}.`;
    const result = await db.notification.createMany({
      data: [{
        id: notificationId(`${userId}:${key}`), userId, type, title: show.title, body,
        tmdbId: show.tmdbId, mediaType: "tv", scheduledFor: scheduledAirDate(episode.airDate),
      }],
      skipDuplicates: true,
    });
    if (result.count === 1) {
      created += 1;
      pushEvents.push({ title: show.title, body, tmdbId: show.tmdbId });
      existingKeys.add(key);
    }
  }
  return { created, pushEvents };
}

export async function syncNotificationsForUser(userId: string, options: { sendPush?: boolean; refreshEnded?: boolean; now?: Date } = {}) {
  const now = options.now ?? new Date();
  const user = await db.user.findUnique({ where: { id: userId }, select: { id: true, timezone: true } });
  if (!user) return { refreshed: 0, refreshFailed: 0, changed: 0, push: { sent: 0, failed: 0, enabled: false } };

  const rawShows = await db.media.findMany({
    where: {
      userId,
      type: "series",
      isFollowing: true,
      status: { in: ["not_started", "watching", "uptodate"] },
      OR: [{ notifyOnNewEpisode: null }, { notifyOnNewEpisode: true }],
      tmdbId: { not: null },
    },
    select: { tmdbId: true, title: true },
  });
  const shows: TrackedShow[] = rawShows
    .filter((show): show is { tmdbId: number; title: string } => show.tmdbId != null)
    .map((show) => ({ tmdbId: show.tmdbId, title: show.title }));
  const ids = [...new Set(shows.map((show) => show.tmdbId))];

  await db.notification.deleteMany({
    where: {
      userId,
      type: { in: SERIES_NOTIFICATION_TYPES },
      ...(ids.length > 0 ? { OR: [{ tmdbId: null }, { tmdbId: { notIn: ids } }] } : {}),
    },
  });
  if (ids.length === 0) {
    await db.notification.deleteMany({ where: { userId, type: { in: SERIES_NOTIFICATION_TYPES } } });
    return { refreshed: 0, refreshFailed: 0, changed: 0, push: { sent: 0, failed: 0, enabled: false } };
  }

  const [{ before, fresh, refreshed, failed }, watched] = await Promise.all([
    freshMetadata(ids, now, options.refreshEnded === true),
    db.watchedEpisode.findMany({
      where: { userId, showId: { in: ids } },
      select: { showId: true, seasonNumber: true, episodeNumber: true },
    }),
  ]);
  const watchedKeys = new Set(watched.map((row) => `${row.showId}:${row.seasonNumber}-${row.episodeNumber}`));
  const backlog = await syncBacklogNotifications(userId, shows, fresh, before, watchedKeys, now);
  const seasons = await syncSeasonEvents(userId, user.timezone, shows, fresh, now);
  const pushEvents = [...backlog.pushEvents, ...seasons.pushEvents];

  let push = { sent: 0, failed: 0, enabled: false };
  if (options.sendPush && pushEvents.length > 0) {
    const payload = pushEvents.length === 1
      ? {
          title: pushEvents[0].title,
          body: pushEvents[0].body,
          url: `/tv/${pushEvents[0].tmdbId}`,
          tag: `tv-${pushEvents[0].tmdbId}`,
        }
      : { title: "Trakora", body: `لديك ${pushEvents.length.toLocaleString("ar-IQ")} تحديثات جديدة في المسلسلات التي تتابعها.`, url: "/", tag: "tv-updates" };
    push = await sendPushToUser(userId, payload);
  }

  return {
    refreshed,
    refreshFailed: failed,
    changed: backlog.changed + seasons.created,
    events: pushEvents.length,
    push,
  };
}
