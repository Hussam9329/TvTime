import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getOrCreateUser, parseUserId } from "@/lib/user";
import { tmdb } from "@/lib/tmdb";

type CompletionInfo = {
  newStatus: "finished" | "uptodate" | "planned" | null;
  isEnded: boolean;
  showTmdbId: number;
  mediaId: string;
  needsRating: boolean;
};

/**
 * Auto-update the show's tracking status based on:
 *  - Number of watched episodes vs total available
 *  - TMDB show status (Ended/Canceled vs Returning Series/In Production)
 *
 * Rules:
 *  - All episodes watched AND show is Ended/Canceled  -> status = "finished" (+ prompt rating)
 *  - All episodes watched AND show is still ongoing    -> status = "uptodate"
 *  - Some episodes unwatched                           -> status = "planned" (back to watchlist)
 *  - Legacy "watched" status is migrated to "finished" or "uptodate" based on TMDB
 *
 * IMPORTANT: We never auto-set userRating. The client opens a RatingDialog when
 * needsRating === true so the user can choose a rating out of 100.
 */
async function autoUpdateShowStatus(userId: string, showTmdbId: number): Promise<CompletionInfo | null> {
  try {
    const media = await db.media.findFirst({
      where: { userId, tmdbId: showTmdbId, type: "series" },
    });
    if (!media) return null;

    const watchedCount = await db.watchedEpisode.count({
      where: { userId, showId: showTmdbId },
    });

    // Fetch fresh show data from TMDB (status + total episodes)
    let tmdbStatus: string | null = null;
    let tmdbTotalEpisodes: number | null = null;
    let tmdbSeasons: number | null = null;
    try {
      const showDetail = await tmdb.tvDetail(showTmdbId);
      tmdbStatus = showDetail.status || null;
      tmdbTotalEpisodes = showDetail.number_of_episodes || null;
      tmdbSeasons = showDetail.number_of_seasons || null;
    } catch (e) {
      console.error("[autoUpdateShowStatus] TMDB fetch failed", e);
    }

    const effectiveTotal = tmdbTotalEpisodes ?? media.episodes ?? 0;
    const isEnded = Boolean(tmdbStatus && /ended|canceled|cancelled/i.test(tmdbStatus));

    const baseUpdate: any = {
      episodes: tmdbTotalEpisodes ?? media.episodes,
      seasons: tmdbSeasons ?? media.seasons,
    };

    // Case 1: All episodes watched
    if (effectiveTotal > 0 && watchedCount >= effectiveTotal) {
      const newStatus = isEnded ? "finished" : "uptodate";
      const statusChanged = media.status !== newStatus;
      const wasNotWatched = !media.watched;

      if (statusChanged || wasNotWatched) {
        await db.media.update({
          where: { id: media.id },
          data: {
            ...baseUpdate,
            watched: true,
            status: newStatus,
            watchedAt: media.watchedAt ?? new Date(),
            // NOTE: Do NOT touch userRating here — client prompts the user.
          },
        });
      }

      // Only prompt for rating if show is finished AND user hasn't rated yet
      const needsRating = isEnded && media.userRating == null;

      return {
        newStatus,
        isEnded,
        showTmdbId,
        mediaId: media.id,
        needsRating,
      };
    }

    // Case 2: Some episodes unwatched — move back to watchlist (planned)
    if (watchedCount === 0 && (media.watched || media.status === "finished" || media.status === "uptodate" || media.status === "watched")) {
      await db.media.update({
        where: { id: media.id },
        data: {
          ...baseUpdate,
          watched: false,
          status: "planned",
          watchedAt: null,
          // Keep existing rating — user might re-watch
        },
      });
      return { newStatus: "planned", isEnded, showTmdbId, mediaId: media.id, needsRating: false };
    }

    // Case 3: Partially watched — make sure it's in watchlist (planned), not stuck in finished/uptodate
    if (watchedCount > 0 && watchedCount < effectiveTotal &&
        (media.status === "finished" || media.status === "uptodate" || media.status === "watched")) {
      await db.media.update({
        where: { id: media.id },
        data: {
          ...baseUpdate,
          watched: false,
          status: "planned",
          watchedAt: null,
        },
      });
      return { newStatus: "planned", isEnded, showTmdbId, mediaId: media.id, needsRating: false };
    }

    // No status change needed
    return { newStatus: (media.status as any) ?? null, isEnded, showTmdbId, mediaId: media.id, needsRating: false };
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
