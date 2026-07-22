import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getOrCreateUser, parseUserId } from "@/lib/user";

export async function POST(req: NextRequest) {
  try {
    const user = await getOrCreateUser(parseUserId(req));
    const shows = await db.media.findMany({ where: { userId: user.id, type: "series", isFollowing: true, status: { in: ["watching", "uptodate"] }, tmdbId: { not: null } }, select: { tmdbId: true, title: true } });
    const ids = shows.map((show) => show.tmdbId!).filter(Boolean);
    if (ids.length === 0) return NextResponse.json({ created: [], count: 0 });
    const start = new Date(); start.setUTCHours(0, 0, 0, 0);
    const [metadata, watched, existingNotifications] = await Promise.all([
      db.tvMetadataCache.findMany({ where: { tmdbId: { in: ids } }, select: { tmdbId: true, airedEpisodeKeys: true } }),
      db.watchedEpisode.findMany({ where: { userId: user.id, showId: { in: ids } }, select: { showId: true, seasonNumber: true, episodeNumber: true } }),
      db.notification.findMany({ where: { userId: user.id, tmdbId: { in: ids }, createdAt: { gte: start } }, select: { tmdbId: true } }),
    ]);
    const watchedKeys = new Set(watched.map((row) => `${row.showId}:${row.seasonNumber}-${row.episodeNumber}`));
    const metadataById = new Map(metadata.map((row) => [row.tmdbId, row]));
    const alreadyNotified = new Set(existingNotifications.map((row) => row.tmdbId));
    const created: Array<{ userId: string; type: string; title: string; body: string; tmdbId: number; mediaType: string }> = [];
    for (const show of shows) {
      if (alreadyNotified.has(show.tmdbId)) continue;
      const meta = metadataById.get(show.tmdbId!);
      const missing = (meta?.airedEpisodeKeys ?? []).filter((key) => !watchedKeys.has(`${show.tmdbId}:${key}`));
      if (missing.length === 0) continue;
      created.push({ userId: user.id, type: missing.length === 1 ? "new_episode" : "backlog_alert", title: show.title, body: missing.length === 1 ? "A released episode is ready to watch." : `${missing.length} released episodes are waiting.`, tmdbId: show.tmdbId!, mediaType: "tv" });
    }
    if (created.length > 0) await db.notification.createMany({ data: created });
    return NextResponse.json({ created: created.map(({ title, body, tmdbId, mediaType, type }) => ({ title, body, tmdbId, mediaType, type })), count: created.length });
  } catch (error) {
    console.error("[notifications:sync]", error);
    return NextResponse.json({ error: "Failed to sync notifications" }, { status: 500 });
  }
}
