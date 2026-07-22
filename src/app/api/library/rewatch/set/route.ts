import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { resolveUserId } from "@/lib/auth";
import { getOrCreateUser } from "@/lib/user";
import { getTvStatusMetadata } from "@/lib/tv-status-server";

function parseEpisodeKey(key: string) {
  const [seasonNumber, episodeNumber] = key.split("-").map(Number);
  return Number.isInteger(seasonNumber) && seasonNumber >= 1 && Number.isInteger(episodeNumber) && episodeNumber >= 1
    ? { seasonNumber, episodeNumber }
    : null;
}

export async function POST(req: NextRequest) {
  try {
    if (req.headers.get("x-confirm-rewatch") !== "REPLACE REWATCH HISTORY") {
      return NextResponse.json({ error: "Explicit rewatch confirmation is required" }, { status: 412 });
    }
    const user = await getOrCreateUser(await resolveUserId(req));
    const body = await req.json();
    const showId = Number(body.showId);
    const count = Number(body.count);
    if (!Number.isInteger(showId) || showId <= 0 || !Number.isInteger(count) || count < 0 || count > 100) {
      return NextResponse.json({ error: "Valid showId and count (0-100) are required" }, { status: 400 });
    }
    const metadata = await getTvStatusMetadata(showId, new Date(), { requireClassification: true });
    const episodes = Array.from(metadata.airedEpisodeKeys).map(parseEpisodeKey).filter((item): item is { seasonNumber: number; episodeNumber: number } => Boolean(item));
    if (episodes.length === 0) return NextResponse.json({ error: "No released episodes were verified" }, { status: 409 });
    const media = await db.media.findUnique({ where: { userId_type_tmdbId: { userId: user.id, type: "series", tmdbId: showId } } });
    if (!media) return NextResponse.json({ error: "Tracked show not found" }, { status: 404 });
    const now = new Date();
    const result = await db.$transaction(async (tx) => {
      await tx.watchedEpisode.createMany({ data: episodes.map((episode) => ({ userId: user.id, showId, ...episode, watchedAt: now })), skipDuplicates: true });
      await tx.watchSession.deleteMany({ where: { userId: user.id, tmdbId: showId, rewatch: true, season: { not: null }, episode: { not: null } } });
      const sessions = episodes.flatMap((episode) => Array.from({ length: count }, () => ({
        userId: user.id,
        mediaId: media.id,
        mediaType: media.isArabic ? "arabic_tv" : media.isAnime ? "anime" : "tv",
        tmdbId: showId,
        title: media.title,
        season: episode.seasonNumber,
        episode: episode.episodeNumber,
        watchedAt: now,
        rewatch: true,
      })));
      for (let offset = 0; offset < sessions.length; offset += 750) await tx.watchSession.createMany({ data: sessions.slice(offset, offset + 750) });
      await tx.media.update({ where: { id: media.id }, data: { watched: metadata.officiallyEnded, status: metadata.officiallyEnded ? "finished" : "uptodate", watchedAt: now, rewatch: count > 0, rewatchCount: count } });
      return { episodes: episodes.length, sessions: sessions.length };
    }, { timeout: 60_000 });
    return NextResponse.json({ ok: true, showId, rewatchCount: count, ...result });
  } catch (error) {
    console.error("[rewatch:set]", error);
    return NextResponse.json({ error: "Failed to replace rewatch history" }, { status: 500 });
  }
}
