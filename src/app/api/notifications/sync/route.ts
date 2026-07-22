import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getOrCreateUser, parseUserId } from "@/lib/user";

export async function POST(req: NextRequest) {
  try {
    const user = await getOrCreateUser(parseUserId(req));
    const shows = await db.media.findMany({ where: { userId: user.id, type: "series", isFollowing: true, tmdbId: { not: null } }, select: { tmdbId: true, title: true } });
    const ids = shows.map((show) => show.tmdbId!).filter(Boolean);
    if (ids.length === 0) return NextResponse.json({ created: [], count: 0 });
    const [metadata, watched] = await Promise.all([
      db.tvMetadataCache.findMany({ where: { tmdbId: { in: ids } }, select: { tmdbId: true, airedEpisodeKeys: true } }),
      db.watchedEpisode.findMany({ where: { userId: user.id, showId: { in: ids } }, select: { showId: true, seasonNumber: true, episodeNumber: true } }),
    ]);
    const watchedKeys = new Set(watched.map((row) => `${row.showId}:${row.seasonNumber}-${row.episodeNumber}`));
    const start = new Date(); start.setUTCHours(0, 0, 0, 0);
    const created: Array<{ id: string; title: string; body: string; tmdbId: number | null }> = [];
    for (const show of shows) {
      const meta = metadata.find((row) => row.tmdbId === show.tmdbId);
      const missing = (meta?.airedEpisodeKeys ?? []).filter((key) => !watchedKeys.has(`${show.tmdbId}:${key}`));
      if (missing.length === 0) continue;
      const exists = await db.notification.findFirst({ where: { userId: user.id, tmdbId: show.tmdbId, type: "new_episode", createdAt: { gte: start } } });
      if (exists) continue;
      const row = await db.notification.create({ data: { userId: user.id, type: "new_episode", title: show.title, body: missing.length === 1 ? "A released episode is ready to watch." : `${missing.length} released episodes are waiting.`, tmdbId: show.tmdbId, mediaType: "tv" } });
      created.push(row);
    }
    return NextResponse.json({ created, count: created.length });
  } catch (error) {
    console.error("[notifications:sync]", error);
    return NextResponse.json({ error: "Failed to sync notifications" }, { status: 500 });
  }
}
