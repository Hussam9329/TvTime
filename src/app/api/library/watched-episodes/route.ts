import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getOrCreateUser, parseUserId } from "@/lib/user";
import {
  deriveTvTrackingState,
  episodeKey,
  normalizeTvTrackingState,
  tvStateToMediaPatch,
  type TvTrackingState,
} from "@/lib/tv-status-engine";
import {
  getTvStatusMetadata,
  validateReleasedEpisodeBatch,
  type TvEpisodeRequest,
} from "@/lib/tv-status-server";
import { materializeLegacyCompletionSnapshot } from "@/lib/tv-status-repair";

type CompletionInfo = {
  newStatus: TvTrackingState;
  isEnded: boolean | null;
  showTmdbId: number;
  mediaId: string;
  needsRating: boolean;
  airedEpisodeCount: number | null;
  watchedAiredEpisodeCount: number;
  ignoredFutureEpisodeCount: number;
  verified: boolean;
};

function posterUrl(path: string | null): string | null {
  if (!path) return null;
  return path.startsWith("http") ? path : `https://image.tmdb.org/t/p/w500${path}`;
}

function isLegacyCompleted(media: { watched: boolean; status: string | null }, episodeCount: number): boolean {
  const state = normalizeTvTrackingState(media.status);
  return episodeCount === 0 && Boolean(
    media.watched || state === "finished" || state === "uptodate",
  );
}

async function ensureSeriesMedia(userId: string, showTmdbId: number) {
  const existing = await db.media.findFirst({
    where: { userId, tmdbId: showTmdbId, type: "series" },
  });
  if (existing) return existing;

  const metadata = await getTvStatusMetadata(showTmdbId);
  return db.media.create({
    data: {
      userId,
      tmdbId: showTmdbId,
      title: metadata.title,
      type: "series",
      poster: posterUrl(metadata.posterPath),
      overview: metadata.overview,
      year: metadata.firstAirDate?.slice(0, 4) || null,
      episodes: metadata.totalEpisodes,
      seasons: metadata.totalSeasons,
      status: "not_started",
      watched: false,
    },
  });
}

/**
 * The only server-side state transition for TV tracking.
 * Whole-show ratings are intentionally never read or written here.
 */
async function autoUpdateShowStatus(userId: string, showTmdbId: number): Promise<CompletionInfo | null> {
  try {
    const media = await db.media.findFirst({
      where: { userId, tmdbId: showTmdbId, type: "series" },
    });
    if (!media) return null;

    const watchedEpisodes = await db.watchedEpisode.findMany({
      where: { userId, showId: showTmdbId },
      select: { seasonNumber: true, episodeNumber: true, watchedAt: true },
      orderBy: { watchedAt: "desc" },
    });

    let metadata: Awaited<ReturnType<typeof getTvStatusMetadata>> | null = null;
    try {
      metadata = await getTvStatusMetadata(showTmdbId);
    } catch (error) {
      console.warn("[watched-episodes] Unable to verify TV metadata", showTmdbId, error);
    }

    const watchedKeys = watchedEpisodes.map((episode) =>
      episodeKey(episode.seasonNumber, episode.episodeNumber),
    );
    const derived = deriveTvTrackingState({
      persistedStatus: media.status,
      officiallyEnded: metadata ? metadata.officiallyEnded : null,
      airedEpisodeCount: metadata?.airedEpisodeCount ?? null,
      airedEpisodeKeys: metadata?.airedEpisodeKeys,
      watchedEpisodeKeys: watchedKeys,
      legacyCompleted: isLegacyCompleted(media, watchedEpisodes.length),
    });

    const lastWatchedAt = watchedEpisodes[0]?.watchedAt ?? media.watchedAt;
    const statePatch = tvStateToMediaPatch(derived.state, lastWatchedAt);
    const update: Record<string, unknown> = {
      ...statePatch,
    };

    if (metadata) {
      if (metadata.totalEpisodes != null) update.episodes = metadata.totalEpisodes;
      if (metadata.totalSeasons != null) update.seasons = metadata.totalSeasons;
      if (!media.poster && metadata.posterPath) update.poster = posterUrl(metadata.posterPath);
      if (!media.overview && metadata.overview) update.overview = metadata.overview;
    }

    const updated = await db.media.update({ where: { id: media.id }, data: update });

    return {
      newStatus: derived.state,
      isEnded: metadata ? metadata.officiallyEnded : null,
      showTmdbId,
      mediaId: updated.id,
      needsRating: derived.state === "finished" && updated.userRating == null,
      airedEpisodeCount: derived.airedEpisodeCount,
      watchedAiredEpisodeCount: derived.watchedAiredEpisodeCount,
      ignoredFutureEpisodeCount: derived.futureOrUnknownWatchedEpisodeCount,
      verified: derived.verified,
    };
  } catch (error) {
    console.error("[autoUpdateShowStatus]", error);
    return null;
  }
}

function parseRequestedEpisode(value: any): TvEpisodeRequest | null {
  const seasonNumber = Number(value?.seasonNumber);
  const episodeNumber = Number(value?.episodeNumber);
  if (!Number.isInteger(seasonNumber) || seasonNumber < 1) return null;
  if (!Number.isInteger(episodeNumber) || episodeNumber < 1) return null;
  return {
    seasonNumber,
    episodeNumber,
    episodeName: typeof value?.episodeName === "string" ? value.episodeName : null,
  };
}

export async function GET(req: NextRequest) {
  try {
    const user = await getOrCreateUser(parseUserId(req));
    const url = new URL(req.url);
    const showId = url.searchParams.get("showId");

    const numericShowId = showId ? Number(showId) : null;
    if (numericShowId && Number.isInteger(numericShowId) && numericShowId > 0) {
      const media = await db.media.findFirst({
        where: { userId: user.id, tmdbId: numericShowId, type: "series" },
      });
      if (media) {
        await materializeLegacyCompletionSnapshot({ media });
      }
    }

    const items = await db.watchedEpisode.findMany({
      where: {
        userId: user.id,
        ...(numericShowId ? { showId: numericShowId } : {}),
      },
      orderBy: { watchedAt: "desc" },
    });
    return NextResponse.json({ items });
  } catch (error) {
    console.error("[watched-episodes:GET]", error);
    return NextResponse.json({ error: "Failed to load episodes" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await getOrCreateUser(parseUserId(req));
    const body = await req.json();
    const showId = Number(body.showId);
    if (!Number.isInteger(showId) || showId <= 0) {
      return NextResponse.json({ error: "A valid showId is required" }, { status: 400 });
    }

    const requested = Array.isArray(body.episodes)
      ? body.episodes.map(parseRequestedEpisode).filter(Boolean) as TvEpisodeRequest[]
      : [parseRequestedEpisode(body)].filter(Boolean) as TvEpisodeRequest[];

    if (requested.length === 0) {
      return NextResponse.json(
        { error: "seasonNumber and episodeNumber are required" },
        { status: 400 },
      );
    }

    const validation = await validateReleasedEpisodeBatch(showId, requested);
    if (validation.blocked.length > 0) {
      return NextResponse.json(
        {
          error: "Future or unaired episodes cannot be marked as watched.",
          code: "EPISODE_NOT_RELEASED",
          blockedEpisodes: validation.blocked,
        },
        { status: 409 },
      );
    }

    await ensureSeriesMedia(user.id, showId);

    const requestedNames = new Map(
      requested.map((episode) => [
        episodeKey(episode.seasonNumber, episode.episodeNumber),
        episode.episodeName || null,
      ]),
    );

    await db.$transaction(
      validation.released.map((episode) =>
        db.watchedEpisode.upsert({
          where: {
            userId_showId_seasonNumber_episodeNumber: {
              userId: user.id,
              showId,
              seasonNumber: episode.seasonNumber,
              episodeNumber: episode.episodeNumber,
            },
          },
          create: {
            userId: user.id,
            showId,
            seasonNumber: episode.seasonNumber,
            episodeNumber: episode.episodeNumber,
            episodeName: requestedNames.get(episodeKey(episode.seasonNumber, episode.episodeNumber))
              || episode.episodeName,
            runtime: episode.runtime,
          },
          update: {
            episodeName: requestedNames.get(episodeKey(episode.seasonNumber, episode.episodeNumber))
              || episode.episodeName,
            runtime: episode.runtime,
          },
        }),
      ),
    );

    const completion = await autoUpdateShowStatus(user.id, showId);
    return NextResponse.json({
      ok: true,
      count: validation.released.length,
      completion,
    });
  } catch (error) {
    console.error("[watched-episodes:POST]", error);
    return NextResponse.json({ error: "Failed to mark episode watched" }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const user = await getOrCreateUser(parseUserId(req));
    const url = new URL(req.url);
    const showId = Number(url.searchParams.get("showId"));
    const seasonNumber = Number(url.searchParams.get("seasonNumber"));
    const episodeNumber = Number(url.searchParams.get("episodeNumber"));

    if (!Number.isInteger(showId) || showId <= 0
      || !Number.isInteger(seasonNumber) || seasonNumber < 1
      || !Number.isInteger(episodeNumber) || episodeNumber < 1) {
      return NextResponse.json({ error: "showId, seasonNumber and episodeNumber are required" }, { status: 400 });
    }

    const [media, existingCount] = await Promise.all([
      db.media.findFirst({ where: { userId: user.id, tmdbId: showId, type: "series" } }),
      db.watchedEpisode.count({ where: { userId: user.id, showId } }),
    ]);

    // Older versions stored whole-show completion without individual episode rows.
    // Snapshot only episodes released at the historic completion time, then remove
    // the explicitly selected episode. Newly aired episodes remain unwatched.
    if (media && isLegacyCompleted(media, existingCount)) {
      await materializeLegacyCompletionSnapshot({ media, existingEpisodeCount: existingCount });
    }

    await db.watchedEpisode.deleteMany({
      where: { userId: user.id, showId, seasonNumber, episodeNumber },
    });

    const completion = await autoUpdateShowStatus(user.id, showId);
    return NextResponse.json({ ok: true, completion });
  } catch (error) {
    console.error("[watched-episodes:DELETE]", error);
    return NextResponse.json({ error: "Failed to unmark episode" }, { status: 500 });
  }
}
