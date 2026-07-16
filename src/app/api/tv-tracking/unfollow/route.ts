import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getOrCreateUser, parseUserId } from "@/lib/user";
import { normalizeMedia } from "@/lib/media-normalize";

/**
 * Dedicated unfollow endpoint for TV shows.
 *
 * POST /api/tv-tracking/unfollow
 * Body: { "tmdbId": 123, "keepProgress": true }
 *
 * - keepProgress=true: clears the following state only and preserves episodes/ratings
 * - keepProgress=false: atomically clears this show's episodes, episode ratings and Media state
 */
export async function POST(req: NextRequest) {
  try {
    const user = await getOrCreateUser(parseUserId(req));
    const body = await req.json();
    const tmdbId = Number(body?.tmdbId);
    const keep = body?.keepProgress !== false;

    if (!Number.isInteger(tmdbId) || tmdbId <= 0) {
      return NextResponse.json(
        { error: "tmdbId (positive integer) is required", code: "INVALID_TMDB_ID", changed: false },
        { status: 400 },
      );
    }

    const media = await db.media.findUnique({
      where: {
        userId_type_tmdbId: {
          userId: user.id,
          type: "series",
          tmdbId,
        },
      },
    });

    if (!media) {
      return NextResponse.json(
        { error: "Show not found in your library", code: "NOT_FOUND", changed: false },
        { status: 404 },
      );
    }

    const activeProgressStates = new Set(["watching", "uptodate", "finished"]);

    if (keep) {
      const watchedEpisodeCount = await db.watchedEpisode.count({
        where: { userId: user.id, showId: tmdbId },
      });
      const hasProgress = watchedEpisodeCount > 0
        || media.watched
        || activeProgressStates.has(String(media.status || ""));
      const needsStateCleanup = !hasProgress
        && (media.status !== null || media.watched || media.watchedAt !== null);
      const changed = media.isFollowing || needsStateCleanup;

      if (!changed) {
        return NextResponse.json({
          ok: true,
          changed: false,
          action: "unfollow_keep_progress",
          item: normalizeMedia(media),
          message: "The show was already unfollowed. Episode progress is unchanged.",
        });
      }

      const updated = await db.media.update({
        where: { id: media.id },
        data: {
          isFollowing: false,
          ...(hasProgress ? {} : { status: null, watched: false, watchedAt: null }),
        },
      });

      return NextResponse.json({
        ok: true,
        changed,
        action: "unfollow_keep_progress",
        item: normalizeMedia(updated),
        message: "Unfollowed. Episode progress was kept.",
      });
    }

    // All three writes are one atomic unit. A failure rolls every deletion/update back.
    const [deletedEpisodes, deletedRatings, updated] = await db.$transaction([
      db.watchedEpisode.deleteMany({
        where: { userId: user.id, showId: tmdbId },
      }),
      db.rating.deleteMany({
        where: {
          userId: user.id,
          tmdbId,
          mediaType: { startsWith: "episode:" },
        },
      }),
      db.media.update({
        where: { id: media.id },
        data: {
          isFollowing: false,
          status: null,
          watched: false,
          watchedAt: null,
          // Whole-show rating remains independent from episode progress.
        },
      }),
    ]);

    const changed = media.isFollowing
      || media.status !== null
      || media.watched
      || media.watchedAt !== null
      || deletedEpisodes.count > 0
      || deletedRatings.count > 0;

    return NextResponse.json({
      ok: true,
      changed,
      action: "unfollow_clear_all",
      item: normalizeMedia(updated),
      deletedEpisodes: deletedEpisodes.count,
      deletedRatings: deletedRatings.count,
      message: changed
        ? `Unfollowed. ${deletedEpisodes.count} watched episodes and ${deletedRatings.count} episode ratings cleared.`
        : "The show was already unfollowed with no saved episode progress.",
    });
  } catch (error: unknown) {
    console.error("[tv-tracking:unfollow]", error);
    return NextResponse.json({ error: "Failed to unfollow", changed: false }, { status: 500 });
  }
}
