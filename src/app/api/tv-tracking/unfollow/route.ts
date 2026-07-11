import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getOrCreateUser, parseUserId } from "@/lib/user";
import { normalizeMedia } from "@/lib/media-normalize";

/**
 * Fix #3: Dedicated unfollow endpoint for TV shows.
 *
 * POST /api/tv-tracking/unfollow
 * Body: { "tmdbId": 123, "keepProgress": true }
 *
 * - keepProgress=true: sets status=null only, keeps watched episodes + rating
 * - keepProgress=false: deletes ALL watched episodes + resets media status
 *
 * This bypasses the episode-engine protection in PATCH /api/media/[id] which
 * prevents direct status writes for shows with episode progress.
 */
export async function POST(req: NextRequest) {
  try {
    const user = await getOrCreateUser(parseUserId(req));
    const body = await req.json();
    const { tmdbId, keepProgress } = body;

    if (!tmdbId || typeof tmdbId !== "number") {
      return NextResponse.json(
        { error: "tmdbId (number) is required", code: "INVALID_TMDB_ID" },
        { status: 400 },
      );
    }

    const keep = keepProgress !== false; // default: true

    // Find the media item
    const media = await db.media.findFirst({
      where: { userId: user.id, tmdbId, type: "series" },
    });

    if (!media) {
      return NextResponse.json(
        { error: "Show not found in your library", code: "NOT_FOUND", changed: false },
        { status: 404 },
      );
    }

    if (keep) {
      // Just clear status — keep episodes and rating
      const updated = await db.media.update({
        where: { id: media.id },
        data: { status: null, watched: false, watchedAt: null },
      });
      return NextResponse.json({
        ok: true,
        changed: true,
        action: "unfollow_keep_progress",
        item: normalizeMedia(updated),
        message: "Unfollowed. Episode progress was kept.",
      });
    } else {
      // Delete ALL watched episodes for this show
      const deletedEpisodes = await db.watchedEpisode.deleteMany({
        where: { userId: user.id, showId: tmdbId },
      });

      // Also delete episode-level ratings (episode:S:E format)
      const episodeRatingPattern = `episode:%`;
      const deletedRatings = await db.rating.deleteMany({
        where: {
          userId: user.id,
          mediaType: { startsWith: "episode:" },
        },
      }).catch(() => ({ count: 0 }));

      // Reset media status
      const updated = await db.media.update({
        where: { id: media.id },
        data: {
          status: null,
          watched: false,
          watchedAt: null,
          // Keep userRating — user may want to preserve their show rating
        },
      });

      return NextResponse.json({
        ok: true,
        changed: true,
        action: "unfollow_clear_all",
        item: normalizeMedia(updated),
        deletedEpisodes: deletedEpisodes.count,
        deletedRatings: deletedRatings.count,
        message: `Unfollowed. ${deletedEpisodes.count} watched episodes cleared.`,
      });
    }
  } catch (error: any) {
    console.error("[tv-tracking:unfollow]", error);
    return NextResponse.json(
      { error: error?.message || "Failed to unfollow", changed: false },
      { status: 500 },
    );
  }
}
