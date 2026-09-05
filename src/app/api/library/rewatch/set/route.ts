import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { resolveUserId } from "@/lib/auth";
import { getOrCreateUser } from "@/lib/user";
import { getTvStatusMetadata, getAllReleasedEpisodes } from "@/lib/tv-status-server";

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
    const now = new Date();
    const metadata = await getTvStatusMetadata(showId, now, { requireClassification: true });
    // ReleasedEpisode rows carry the per-episode runtime so every rewatch
    // WatchSession can store a real duration. The previous key-only variant
    // created sessions with duration=NULL and library/stats had to fall back
    // to a flat 45-minute guess, inflating total watch time by hours.
    const releasedEpisodes = await getAllReleasedEpisodes(showId, now, metadata);
    if (releasedEpisodes.length === 0) return NextResponse.json({ error: "No released episodes were verified" }, { status: 409 });
    const media = await db.media.findUnique({ where: { userId_type_tmdbId: { userId: user.id, type: "series", tmdbId: showId } } });
    if (!media) return NextResponse.json({ error: "Tracked show not found" }, { status: 404 });
    const result = await db.$transaction(async (tx) => {
      await tx.$queryRaw<Array<{ id: string }>>`
        SELECT "id"
        FROM "Media"
        WHERE "id" = ${media.id}
        FOR UPDATE
      `;
      const lockedMedia = await tx.media.findUnique({ where: { id: media.id } });
      if (!lockedMedia) throw new Error("Tracked show disappeared while replacing rewatch history");

      await tx.watchedEpisode.createMany({
        data: releasedEpisodes.map((episode) => ({
          userId: user.id,
          showId,
          seasonNumber: episode.seasonNumber,
          episodeNumber: episode.episodeNumber,
          episodeName: episode.episodeName,
          runtime: episode.runtime,
          watchedAt: now,
        })),
        skipDuplicates: true,
      });
      await tx.watchSession.deleteMany({ where: { userId: user.id, tmdbId: showId, rewatch: true, season: { not: null }, episode: { not: null } } });
      const sessions = releasedEpisodes.flatMap((episode) => Array.from({ length: count }, () => ({
        userId: user.id,
        mediaId: lockedMedia.id,
        mediaType: lockedMedia.isArabic ? "arabic_tv" : lockedMedia.isAnime ? "anime" : "tv",
        tmdbId: showId,
        title: lockedMedia.title,
        season: episode.seasonNumber,
        episode: episode.episodeNumber,
        watchedAt: now,
        rewatch: true,
        duration: episode.runtime,
      })));
      for (let offset = 0; offset < sessions.length; offset += 750) await tx.watchSession.createMany({ data: sessions.slice(offset, offset + 750) });
      const canRemainFinished = metadata.officiallyEnded && lockedMedia.userRating != null;
      await tx.media.update({
        where: { id: lockedMedia.id },
        data: {
          watched: canRemainFinished,
          status: canRemainFinished ? "finished" : "uptodate",
          watchedAt: now,
          rewatch: count > 0,
          rewatchCount: count,
        },
      });
      return { episodes: releasedEpisodes.length, sessions: sessions.length };
    }, { timeout: 60_000 });
    return NextResponse.json({ ok: true, showId, rewatchCount: count, ...result });
  } catch (error) {
    console.error("[rewatch:set]", error);
    return NextResponse.json({ error: "Failed to replace rewatch history" }, { status: 500 });
  }
}
