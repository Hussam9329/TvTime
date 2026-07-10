import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getOrCreateUser, parseUserId } from "@/lib/user";
import { normalizeMediaMany } from "@/lib/media-normalize";

// GET - export all library data as JSON (Media + legacy tables + episodes)
export async function GET(req: NextRequest) {
  const userId = parseUserId(req);
  if (!userId) return NextResponse.json({ error: "userId required" }, { status: 400 });

  const user = await getOrCreateUser(userId);

  const [media, watchedEpisodes] = await Promise.all([
    db.media.findMany({ where: { userId: user.id } }),
    db.watchedEpisode.findMany({ where: { userId: user.id } }),
  ]);

  const exportData = {
    version: 2,
    exportedAt: new Date().toISOString(),
    app: "CineTrack",
    user: { name: user.name, avatar: user.avatar, createdAt: user.createdAt },
    library: {
      media: normalizeMediaMany(media),
      watchedEpisodes,
    },
  };

  return NextResponse.json(exportData);
}
