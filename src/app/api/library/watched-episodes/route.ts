import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getOrCreateUser, parseUserId } from "@/lib/user";
import { tmdb } from "@/lib/tmdb";
import {
  availableEpisodeCountFromTmdb,
  canonicalStateFromLegacy,
  deriveSeriesProgressState,
  trackingBucketForState,
  type CanonicalMediaState,
} from "@/lib/media-state";
import { ensureCanonicalMedia, updateCanonicalMediaState } from "@/lib/media-repository";

type CompletionInfo = {
  newStatus: "finished" | "uptodate" | "planned" | null;
  libraryState: CanonicalMediaState;
  isEnded: boolean;
  showTmdbId: number;
  mediaId: string;
  needsRating: boolean;
};

/**
 * Recomputes a show's canonical state after an episode mutation. Episode rows
 * are facts; `Media.libraryState` is the single work-level state. A rating is
 * never created, removed or interpreted as a watched signal here.
 */
async function autoUpdateShowStatus(userId: string, showTmdbId: number): Promise<CompletionInfo | null> {
  try {
    let media = await db.media.findFirst({
      where: { userId, tmdbId: showTmdbId, type: "series" },
    });

    let detail: any = null;
    try {
      detail = await tmdb.tvDetail(showTmdbId);
    } catch (error) {
      console.warn("[autoUpdateShowStatus] TMDB refresh failed; using stored totals", error);
    }

    // Episode facts must never exist without a canonical work-level row.
    // This also supports marking an episode before pressing Follow.
    if (!media) {
      media = await ensureCanonicalMedia({
        userId,
        tmdbId: showTmdbId,
        title: detail?.name || `TV ${showTmdbId}`,
        type: "series",
        poster: detail?.poster_path || null,
        year: detail?.first_air_date ? String(detail.first_air_date).slice(0, 4) : null,
        overview: detail?.overview || null,
        rating: detail?.vote_average ?? null,
        seasons: detail?.number_of_seasons ?? null,
        episodes: detail?.number_of_episodes ?? null,
        genres: Array.isArray(detail?.genres) ? detail.genres.map((genre: any) => genre?.name).filter(Boolean) : [],
        isAnime: Array.isArray(detail?.origin_country) && detail.origin_country.includes("JP") &&
          Array.isArray(detail?.genres) && detail.genres.some((genre: any) => Number(genre?.id) === 16),
        initialState: "planned",
      });
    }

    const watchedCount = await db.watchedEpisode.count({
      where: { userId, showId: showTmdbId, seasonNumber: { gt: 0 } },
    });

    const tmdbStatus = detail?.status || null;
    const totalEpisodes = detail?.number_of_episodes ?? media.episodes;
    const totalSeasons = detail?.number_of_seasons ?? media.seasons;
    const isEnded = Boolean(tmdbStatus && /ended|canceled|cancelled/i.test(tmdbStatus));
    const availableEpisodes = detail
      ? availableEpisodeCountFromTmdb(detail)
      : totalEpisodes;

    const nextState = deriveSeriesProgressState({
      currentState: canonicalStateFromLegacy(media),
      watchedEpisodes: watchedCount,
      totalEpisodes: isEnded ? totalEpisodes : availableEpisodes,
      isEnded,
      preserveManualCompletionWhenNoEpisodeFacts: false,
    });

    const updated = await updateCanonicalMediaState(media, nextState, {
      completedAt: nextState === "completed" || nextState === "up_to_date" ? new Date() : null,
      data: { episodes: totalEpisodes, seasons: totalSeasons },
    });

    const bucket = trackingBucketForState(nextState);
    return {
      newStatus: bucket === "finished" ? "finished" : bucket === "uptodate" ? "uptodate" : "planned",
      libraryState: nextState,
      isEnded,
      showTmdbId,
      mediaId: updated.id,
      needsRating: nextState === "completed" && updated.userRating == null,
    };
  } catch (error) {
    console.error("[autoUpdateShowStatus]", error);
    return null;
  }
}

// GET - list watched episodes (optionally filter by showId)
export async function GET(req: NextRequest) {
  try {
    const user = await getOrCreateUser(parseUserId(req));
    const url = new URL(req.url);
    const showId = url.searchParams.get("showId");

    const items = await db.watchedEpisode.findMany({
      where: {
        userId: user.id,
        ...(showId ? { showId: Number(showId) } : {}),
      },
      orderBy: { watchedAt: "desc" },
    });
    return NextResponse.json({ items });
  } catch (error) {
    console.error("[watched-episodes:GET]", error);
    return NextResponse.json({ error: "Failed to load episodes" }, { status: 500 });
  }
}

// POST - mark episode as watched (supports bulk via episodes array)
export async function POST(req: NextRequest) {
  try {
    const user = await getOrCreateUser(parseUserId(req));
    const body = await req.json();

    // Bulk mode
    if (Array.isArray(body.episodes)) {
      const showId = Number(body.showId);
      if (!showId) return NextResponse.json({ error: "showId required for bulk" }, { status: 400 });

      const data = body.episodes.map((e: { seasonNumber: number; episodeNumber: number; episodeName?: string }) => ({
        userId: user.id,
        showId,
        seasonNumber: Number(e.seasonNumber),
        episodeNumber: Number(e.episodeNumber),
        episodeName: e.episodeName || null,
      }));

      // Upsert each
      await Promise.all(
        data.map((d: any) =>
          db.watchedEpisode.upsert({
            where: {
              userId_showId_seasonNumber_episodeNumber: {
                userId: d.userId,
                showId: d.showId,
                seasonNumber: d.seasonNumber,
                episodeNumber: d.episodeNumber,
              },
            },
            create: d,
            update: { episodeName: d.episodeName },
          })
        )
      );

      // Auto-update show status (check if fully watched)
      const completion = await autoUpdateShowStatus(user.id, showId);

      return NextResponse.json({ ok: true, count: data.length, completion });
    }

    // Single mode
    const { showId, seasonNumber, episodeNumber, episodeName } = body;
    if (!showId || seasonNumber == null || episodeNumber == null) {
      return NextResponse.json({ error: "showId, seasonNumber, episodeNumber required" }, { status: 400 });
    }

    const item = await db.watchedEpisode.upsert({
      where: {
        userId_showId_seasonNumber_episodeNumber: {
          userId: user.id,
          showId: Number(showId),
          seasonNumber: Number(seasonNumber),
          episodeNumber: Number(episodeNumber),
        },
      },
      create: {
        userId: user.id,
        showId: Number(showId),
        seasonNumber: Number(seasonNumber),
        episodeNumber: Number(episodeNumber),
        episodeName: episodeName || null,
      },
      update: {},
    });

    // Auto-update show status (check if fully watched)
    const completion = await autoUpdateShowStatus(user.id, Number(showId));

    return NextResponse.json({ item, completion });
  } catch (error) {
    console.error("[watched-episodes:POST]", error);
    return NextResponse.json({ error: "Failed to mark episode" }, { status: 500 });
  }
}

// DELETE - remove watched episode
export async function DELETE(req: NextRequest) {
  try {
    const user = await getOrCreateUser(parseUserId(req));
    const url = new URL(req.url);
    const showId = url.searchParams.get("showId");
    const seasonNumber = url.searchParams.get("seasonNumber");
    const episodeNumber = url.searchParams.get("episodeNumber");

    if (!showId || seasonNumber == null || episodeNumber == null) {
      return NextResponse.json({ error: "showId, seasonNumber, episodeNumber required" }, { status: 400 });
    }

    await db.watchedEpisode.deleteMany({
      where: {
        userId: user.id,
        showId: Number(showId),
        seasonNumber: Number(seasonNumber),
        episodeNumber: Number(episodeNumber),
      },
    });

    // Auto-update show status (might need to move back to watchlist)
    const completion = await autoUpdateShowStatus(user.id, Number(showId));

    return NextResponse.json({ ok: true, completion });
  } catch (error) {
    console.error("[watched-episodes:DELETE]", error);
    return NextResponse.json({ error: "Failed to unmark episode" }, { status: 500 });
  }
}
