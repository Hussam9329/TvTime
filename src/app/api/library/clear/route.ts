import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getOrCreateUser } from "@/lib/user";
import { resolveUserId } from "@/lib/auth";

const CONFIRMATION = "DELETE EVERYTHING";

/** Delete every user-owned content record while preserving the account and its preferences. */
export async function DELETE(req: NextRequest) {
  try {
    if (req.headers.get("x-confirm-delete") !== CONFIRMATION) {
      return NextResponse.json({
        error: `Confirmation required. Send header 'x-confirm-delete: ${CONFIRMATION}' to confirm.`,
        code: "CONFIRMATION_REQUIRED",
        hint: "This deletes the library and notifications, but keeps the account preferences.",
      }, { status: 409 });
    }

    const user = await getOrCreateUser(await resolveUserId(req));
    const deleted = await db.$transaction(async (tx) => {
      const watchSessions = await tx.watchSession.deleteMany({ where: { userId: user.id } });
      const notifications = await tx.notification.deleteMany({ where: { userId: user.id } });
      const ratings = await tx.rating.deleteMany({ where: { userId: user.id } });
      const watchedEpisodes = await tx.watchedEpisode.deleteMany({ where: { userId: user.id } });
      const watchlistItems = await tx.watchlistItem.deleteMany({ where: { userId: user.id } });
      const watchedMovies = await tx.watchedMovie.deleteMany({ where: { userId: user.id } });
      const followingShows = await tx.followingShow.deleteMany({ where: { userId: user.id } });
      const media = await tx.media.deleteMany({ where: { userId: user.id } });
      return {
        media: media.count,
        watchedEpisodes: watchedEpisodes.count,
        ratings: ratings.count,
        watchSessions: watchSessions.count,
        notifications: notifications.count,
        legacyWatchlistItems: watchlistItems.count,
        legacyWatchedMovies: watchedMovies.count,
        legacyFollowingShows: followingShows.count,
      };
    }, { maxWait: 10_000, timeout: 60_000 });

    return NextResponse.json({
      ok: true,
      deleted,
      preserved: ["account", "timezone", "country", "preferredPlatforms"],
      source: "all user-owned TvTime content tables",
    });
  } catch (error) {
    console.error("[library:clear]", error);
    return NextResponse.json({ error: "Failed to clear all user content" }, { status: 500 });
  }
}
