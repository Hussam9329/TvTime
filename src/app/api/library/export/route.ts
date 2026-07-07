import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getOrCreateUser, parseUserId } from "@/lib/user";

// GET - export all library data as JSON
export async function GET(req: NextRequest) {
  const userId = parseUserId(req);
  if (!userId) return NextResponse.json({ error: "userId required" }, { status: 400 });

  const user = await getOrCreateUser(userId);

  const [watchlist, watchedMovies, watchedEpisodes, following, ratings] = await Promise.all([
    db.watchlistItem.findMany({ where: { userId: user.id } }),
    db.watchedMovie.findMany({ where: { userId: user.id } }),
    db.watchedEpisode.findMany({ where: { userId: user.id } }),
    db.followingShow.findMany({ where: { userId: user.id } }),
    db.rating.findMany({ where: { userId: user.id } }),
  ]);

  const exportData = {
    version: 1,
    exportedAt: new Date().toISOString(),
    app: "CineTrack",
    user: { name: user.name, avatar: user.avatar },
    library: {
      watchlist,
      watchedMovies,
      watchedEpisodes,
      following,
      ratings,
    },
  };

  return NextResponse.json(exportData);
}
