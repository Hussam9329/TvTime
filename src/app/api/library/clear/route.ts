import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getOrCreateUser, parseUserId } from "@/lib/user";

export async function DELETE(req: NextRequest) {
  try {
    const user = await getOrCreateUser(parseUserId(req));
    const [media, watchedEpisodes, episodeRatings] = await db.$transaction([
      db.media.deleteMany({ where: { userId: user.id } }),
      db.watchedEpisode.deleteMany({ where: { userId: user.id } }),
      db.rating.deleteMany({ where: { userId: user.id, mediaType: { startsWith: "episode:" } } }),
    ]);
    return NextResponse.json({
      ok: true,
      deleted: { media: media.count, watchedEpisodes: watchedEpisodes.count, episodeRatings: episodeRatings.count },
      source: "Media+WatchedEpisode+Rating:episode-only",
    });
  } catch (error) {
    console.error("[library:clear]", error);
    return NextResponse.json({ error: "Failed to clear library" }, { status: 500 });
  }
}
