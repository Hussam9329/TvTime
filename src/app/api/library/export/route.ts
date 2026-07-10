import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getOrCreateUser, parseUserId } from "@/lib/user";
import { normalizeMediaMany } from "@/lib/media-normalize";

export async function GET(req: NextRequest) {
  try {
    const user = await getOrCreateUser(parseUserId(req));
    const [media, watchedEpisodes] = await Promise.all([
      db.media.findMany({ where: { userId: user.id } }),
      db.watchedEpisode.findMany({ where: { userId: user.id } }),
    ]);

    return NextResponse.json({
      version: 3,
      exportedAt: new Date().toISOString(),
      app: "CineTrack",
      sourceOfTruth: "Media.libraryState",
      user: { name: user.name, avatar: user.avatar, createdAt: user.createdAt },
      library: { media: normalizeMediaMany(media), watchedEpisodes },
    });
  } catch (error) {
    console.error("[library:export]", error);
    return NextResponse.json({ error: "Failed to export library" }, { status: 500 });
  }
}
