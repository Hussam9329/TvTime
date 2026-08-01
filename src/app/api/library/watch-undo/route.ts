import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { resolveUserId } from "@/lib/auth";
import { verifyWatchUndoToken, type MediaWatchSnapshot } from "@/lib/watch-undo-token";

function mediaRestoreData(snapshot: MediaWatchSnapshot) {
  return {
    watched: snapshot.watched,
    watchedAt: snapshot.watchedAt ? new Date(snapshot.watchedAt) : null,
    status: snapshot.status,
    userRating: snapshot.userRating,
    rewatch: snapshot.rewatch,
    rewatchCount: snapshot.rewatchCount,
    tags: snapshot.tags,
  };
}

export async function POST(req: NextRequest) {
  try {
    const userId = await resolveUserId(req);
    const body = await req.json().catch(() => null);
    const token = typeof body?.token === "string" ? body.token : "";
    if (!token) return NextResponse.json({ error: "Watch undo token is required." }, { status: 400 });

    const undo = await verifyWatchUndoToken(token);
    if (undo.userId !== userId) {
      return NextResponse.json({ error: "This undo action belongs to another account." }, { status: 403 });
    }

    if (undo.kind === "movie") {
      const media = await db.media.findFirst({ where: { id: undo.mediaId, userId, type: "movie" } });
      if (!media) return NextResponse.json({ error: "Movie state no longer exists." }, { status: 409 });
      const item = await db.media.update({
        where: { id: media.id },
        data: mediaRestoreData(undo.mediaBefore),
      });
      return NextResponse.json({ ok: true, kind: undo.kind, item });
    }

    await db.$transaction(async (tx) => {
      const media = await tx.media.findFirst({
        where: { id: undo.mediaId, userId, type: "series", tmdbId: undo.showId },
      });
      if (!media) throw new Error("Series state no longer exists.");

      if (undo.rewatchCreatedAt) {
        const createdAt = new Date(undo.rewatchCreatedAt);
        await tx.watchSession.deleteMany({
          where: {
            userId,
            tmdbId: undo.showId,
            rewatch: true,
            createdAt,
            OR: undo.episodesBefore.map((episode) => ({
              season: episode.seasonNumber,
              episode: episode.episodeNumber,
            })),
          },
        });
      }

      for (const episode of undo.episodesBefore) {
        const identity = {
          userId_showId_seasonNumber_episodeNumber: {
            userId,
            showId: undo.showId,
            seasonNumber: episode.seasonNumber,
            episodeNumber: episode.episodeNumber,
          },
        };
        if (episode.row) {
          await tx.watchedEpisode.upsert({
            where: identity,
            create: {
              userId,
              showId: undo.showId,
              seasonNumber: episode.seasonNumber,
              episodeNumber: episode.episodeNumber,
              episodeName: episode.row.episodeName,
              runtime: episode.row.runtime,
              watchedAt: new Date(episode.row.watchedAt),
            },
            update: {
              episodeName: episode.row.episodeName,
              runtime: episode.row.runtime,
              watchedAt: new Date(episode.row.watchedAt),
            },
          });
        } else {
          await tx.watchedEpisode.deleteMany({
            where: {
              userId,
              showId: undo.showId,
              seasonNumber: episode.seasonNumber,
              episodeNumber: episode.episodeNumber,
            },
          });
        }
      }

      if (undo.mediaBefore) {
        await tx.media.update({
          where: { id: media.id },
          data: mediaRestoreData(undo.mediaBefore),
        });
        return;
      }

      // Marking the very first episode may have created the canonical Media
      // row. Remove that now-empty row only if no later user action started
      // using it during the five-second undo window.
      const watchedEpisodeCount = await tx.watchedEpisode.count({ where: { userId, showId: undo.showId } });
      const current = await tx.media.findUnique({ where: { id: media.id } });
      const disposable = current
        && watchedEpisodeCount === 0
        && current.userRating == null
        && !current.isFollowing
        && [null, "not_started", "watching", "uptodate"].includes(current.status);
      if (disposable) await tx.media.delete({ where: { id: media.id } });
    }, { timeout: 30_000 });

    return NextResponse.json({ ok: true, kind: undo.kind });
  } catch (error) {
    console.error("[watch-undo]", error);
    const expired = error instanceof Error && /exp|expired|token/i.test(error.message);
    return NextResponse.json(
      { error: expired ? "The five-second undo window has expired." : "Failed to undo the watch action." },
      { status: expired ? 410 : 500 },
    );
  }
}
