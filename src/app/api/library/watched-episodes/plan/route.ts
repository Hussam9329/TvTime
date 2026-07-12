import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getOrCreateUser, parseUserId } from "@/lib/user";
import { episodeKey } from "@/lib/tv-status-engine";
import { getAllReleasedEpisodes } from "@/lib/tv-status-server";
import { materializeLegacyCompletionSnapshot } from "@/lib/tv-status-repair";

/**
 * Read-only context used immediately before a user changes episode progress.
 * It provides the complete released timeline and the user's current watched
 * keys without creating per-card/per-day client fan-out.
 */
export async function GET(req: NextRequest) {
  try {
    const user = await getOrCreateUser(parseUserId(req));
    const showId = Number(new URL(req.url).searchParams.get("showId"));
    if (!Number.isInteger(showId) || showId <= 0) {
      return NextResponse.json({ error: "A valid showId is required" }, { status: 400 });
    }

    const [media, watchedRows, releasedEpisodes] = await Promise.all([
      db.media.findUnique({
        where: { userId_type_tmdbId: { userId: user.id, type: "series", tmdbId: showId } },
      }),
      db.watchedEpisode.findMany({
        where: { userId: user.id, showId },
        select: { seasonNumber: true, episodeNumber: true },
      }),
      getAllReleasedEpisodes(showId),
    ]);

    const watchedKeys = new Set(
      watchedRows.map((episode) => episodeKey(episode.seasonNumber, episode.episodeNumber)),
    );

    if (media) {
      const snapshot = await materializeLegacyCompletionSnapshot({
        media,
        existingEpisodeCount: watchedRows.length,
        persist: false,
      });
      if (snapshot.attempted && !snapshot.verified) {
        return NextResponse.json(
          { error: "Could not verify earlier episode progress. No progress was changed." },
          { status: 503 },
        );
      }
      for (const episode of snapshot.episodes) {
        watchedKeys.add(episodeKey(episode.seasonNumber, episode.episodeNumber));
      }
    }

    return NextResponse.json({
      releasedEpisodes: releasedEpisodes.map((episode) => ({
        seasonNumber: episode.seasonNumber,
        episodeNumber: episode.episodeNumber,
        episodeName: episode.episodeName,
      })),
      watchedKeys: [...watchedKeys],
      source: "TMDB released timeline + WatchedEpisode",
    }, {
      headers: { "Cache-Control": "private, no-store" },
    });
  } catch (error) {
    console.error("[watched-episodes:plan]", error);
    return NextResponse.json(
      { error: "Failed to verify earlier episode progress" },
      { status: 500 },
    );
  }
}
