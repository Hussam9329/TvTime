import { NextRequest, NextResponse } from "next/server";
import { createHash } from "node:crypto";
import { db } from "@/lib/db";
import { getOrCreateUser } from "@/lib/user";
import { resolveUserId } from "@/lib/auth";
import { getTvSeasonDetail, getTvStatusMetadata } from "@/lib/tv-status-server";
import {
  formatAirDate,
  isSeasonFinale,
  isSeasonPremiere,
  isUpcomingSeasonAlert,
  notificationAlertDates,
  scheduledAirDate,
} from "@/lib/notification-schedule";

const DAILY_EPISODE_TYPES = ["new_episode", "backlog_alert"];
const SEASON_EVENT_TYPES = ["season_premiere", "season_finale"];
const SERIES_NOTIFICATION_TYPES = [...DAILY_EPISODE_TYPES, "season_return", ...SEASON_EVENT_TYPES];

type NotificationDraft = {
  id: string;
  userId: string;
  type: string;
  title: string;
  body: string;
  tmdbId: number;
  mediaType: string;
  scheduledFor?: Date;
};

type CachedMetadata = {
  tmdbId: number;
  airedEpisodeKeys: string[];
  nextEpisodeAirDate: string | null;
  nextEpisodeName: string | null;
  nextEpisodeSeasonNumber: number | null;
  nextEpisodeEpisodeNumber: number | null;
};

function seasonEventKey(type: string, tmdbId: number, airDate: string): string {
  return `${type}:${tmdbId}:${airDate}`;
}

function notificationId(key: string): string {
  return `notif_${createHash("sha256").update(key).digest("hex").slice(0, 32)}`;
}

export async function POST(req: NextRequest) {
  try {
    const user = await getOrCreateUser(await resolveUserId(req));
    const now = new Date();
    const shows = await db.media.findMany({
      where: {
        userId: user.id,
        type: "series",
        isFollowing: true,
        status: { in: ["not_started", "watching", "uptodate"] },
        OR: [{ notifyOnNewEpisode: null }, { notifyOnNewEpisode: true }],
        tmdbId: { not: null },
      },
      select: { tmdbId: true, title: true },
    });
    const ids = shows.map((show) => show.tmdbId!).filter(Boolean);

    // Notifications created while a title was followed must not survive after
    // it is finished, stopped, unfollowed, muted, or moved out of tracking.
    await db.notification.deleteMany({
      where: {
        userId: user.id,
        type: { in: SERIES_NOTIFICATION_TYPES },
        ...(ids.length > 0
          ? { OR: [{ tmdbId: null }, { tmdbId: { notIn: ids } }] }
          : {}),
      },
    });

    if (ids.length === 0) return NextResponse.json({ created: [], count: 0 });

    const recentStart = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    const [cachedMetadata, watched, existingNotifications] = await Promise.all([
      db.tvMetadataCache.findMany({
        where: { tmdbId: { in: ids } },
        select: {
          tmdbId: true,
          airedEpisodeKeys: true,
          nextEpisodeAirDate: true,
          nextEpisodeName: true,
          nextEpisodeSeasonNumber: true,
          nextEpisodeEpisodeNumber: true,
        },
      }),
      db.watchedEpisode.findMany({
        where: { userId: user.id, showId: { in: ids } },
        select: { showId: true, seasonNumber: true, episodeNumber: true },
      }),
      db.notification.findMany({
        where: {
          userId: user.id,
          tmdbId: { in: ids },
          OR: [
            { type: { in: SEASON_EVENT_TYPES } },
            { type: { in: DAILY_EPISODE_TYPES }, createdAt: { gte: recentStart } },
          ],
        },
        select: { type: true, tmdbId: true, scheduledFor: true },
      }),
    ]);

    const metadataById = new Map<number, CachedMetadata>(
      cachedMetadata.map((row) => [row.tmdbId, row]),
    );

    // A newly followed show may not have reached the persistent TV cache yet.
    // Hydrate only those missing rows; existing cache entries retain a date-only
    // episode boundary long enough for an alert on the local air date.
    const missingShows = shows.filter((show) => !metadataById.has(show.tmdbId!));
    const hydrated = await Promise.all(missingShows.map(async (show): Promise<CachedMetadata | null> => {
      try {
        const metadata = await getTvStatusMetadata(show.tmdbId!, now);
        return {
          tmdbId: metadata.tmdbId,
          airedEpisodeKeys: [...metadata.airedEpisodeKeys],
          nextEpisodeAirDate: metadata.nextEpisode?.airDate ?? null,
          nextEpisodeName: metadata.nextEpisode?.name ?? null,
          nextEpisodeSeasonNumber: metadata.nextEpisode?.seasonNumber ?? null,
          nextEpisodeEpisodeNumber: metadata.nextEpisode?.episodeNumber ?? null,
        };
      } catch (error) {
        console.warn("[notifications:sync] Unable to hydrate TV metadata", show.tmdbId, error);
        return null;
      }
    }));
    for (const metadata of hydrated) {
      if (metadata) metadataById.set(metadata.tmdbId, metadata);
    }

    const watchedKeys = new Set(
      watched.map((row) => `${row.showId}:${row.seasonNumber}-${row.episodeNumber}`),
    );
    const recentDailyKeys = new Set(
      existingNotifications
        .filter((item) => DAILY_EPISODE_TYPES.includes(item.type) && item.tmdbId != null)
        .map((item) => `${item.type}:${item.tmdbId}`),
    );
    const existingSeasonKeys = new Set(
      existingNotifications
        .filter((item) => SEASON_EVENT_TYPES.includes(item.type) && item.tmdbId != null && item.scheduledFor)
        .map((item) => seasonEventKey(item.type, item.tmdbId!, item.scheduledFor!.toISOString().slice(0, 10))),
    );
    const created: NotificationDraft[] = [];
    const localNotificationDay = notificationAlertDates(now, user.timezone).values().next().value ?? now.toISOString().slice(0, 10);

    const upcoming = shows.flatMap((show) => {
      const metadata = metadataById.get(show.tmdbId!);
      const episode = metadata?.nextEpisodeAirDate
        && metadata.nextEpisodeSeasonNumber != null
        && metadata.nextEpisodeEpisodeNumber != null
        ? {
            airDate: metadata.nextEpisodeAirDate,
            name: metadata.nextEpisodeName,
            seasonNumber: metadata.nextEpisodeSeasonNumber,
            episodeNumber: metadata.nextEpisodeEpisodeNumber,
          }
        : null;
      return isUpcomingSeasonAlert(episode, now, user.timezone)
        ? [{ show, episode }]
        : [];
    });

    const finaleCandidates = upcoming.filter(({ episode }) => !isSeasonPremiere(episode));
    const seasonDetails = new Map<string, Awaited<ReturnType<typeof getTvSeasonDetail>> | null>();
    await Promise.all(finaleCandidates.map(async ({ show, episode }) => {
      const key = `${show.tmdbId}:${episode.seasonNumber}`;
      if (seasonDetails.has(key)) return;
      try {
        seasonDetails.set(key, await getTvSeasonDetail(show.tmdbId!, episode.seasonNumber));
      } catch (error) {
        console.warn("[notifications:sync] Unable to inspect season finale", key, error);
        seasonDetails.set(key, null);
      }
    }));

    for (const { show, episode } of upcoming) {
      let type: "season_premiere" | "season_finale" | null = null;
      if (isSeasonPremiere(episode)) {
        type = "season_premiere";
      } else {
        const season = seasonDetails.get(`${show.tmdbId}:${episode.seasonNumber}`);
        if (season && isSeasonFinale(episode, season.episodes ?? [])) type = "season_finale";
      }
      if (!type) continue;

      const key = seasonEventKey(type, show.tmdbId!, episode.airDate);
      if (existingSeasonKeys.has(key)) continue;
      const dateLabel = formatAirDate(episode.airDate, user.timezone);
      created.push({
        id: notificationId(`${user.id}:${key}`),
        userId: user.id,
        type,
        title: show.title,
        body: type === "season_premiere"
          ? `يبدأ الموسم ${episode.seasonNumber} في ${dateLabel}.`
          : `تُعرض الحلقة النهائية للموسم ${episode.seasonNumber} في ${dateLabel}.`,
        tmdbId: show.tmdbId!,
        mediaType: "tv",
        scheduledFor: scheduledAirDate(episode.airDate),
      });
      existingSeasonKeys.add(key);
    }

    for (const show of shows) {
      const metadata = metadataById.get(show.tmdbId!);
      const missing = (metadata?.airedEpisodeKeys ?? [])
        .filter((key) => !watchedKeys.has(`${show.tmdbId}:${key}`));
      if (missing.length === 0) continue;
      const type = missing.length === 1 ? "new_episode" : "backlog_alert";
      const dailyKey = `${type}:${show.tmdbId}`;
      if (recentDailyKeys.has(dailyKey)) continue;
      created.push({
        id: notificationId(`${user.id}:${dailyKey}:${localNotificationDay}`),
        userId: user.id,
        type,
        title: show.title,
        body: missing.length === 1
          ? "A released episode is ready to watch."
          : `${missing.length} released episodes are waiting.`,
        tmdbId: show.tmdbId!,
        mediaType: "tv",
      });
      recentDailyKeys.add(dailyKey);
    }

    // Deterministic IDs plus skipDuplicates close the race between the global
    // background sync and an immediately opened notification center.
    const persisted: NotificationDraft[] = [];
    if (created.length > 0) {
      await db.$transaction(async (tx) => {
        for (const notification of created) {
          const result = await tx.notification.createMany({ data: [notification], skipDuplicates: true });
          if (result.count === 1) persisted.push(notification);
        }
      });
    }
    return NextResponse.json({
      created: persisted.map(({ title, body, tmdbId, mediaType, type }) => ({ title, body, tmdbId, mediaType, type })),
      count: persisted.length,
    });
  } catch (error) {
    console.error("[notifications:sync]", error);
    return NextResponse.json({ error: "Failed to sync notifications" }, { status: 500 });
  }
}
