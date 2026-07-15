import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getOrCreateUser, parseUserId } from "@/lib/user";
import { canonicalMediaPoster } from "@/lib/media-poster";

function toCompat(item: any) {
  return { ...item, posterPath: item.poster, followedAt: item.addedAt };
}

// Compatibility endpoint backed only by Media tracking states.
export async function GET(req: NextRequest) {
  try {
    const user = await getOrCreateUser(parseUserId(req));
    const items = await db.media.findMany({
      where: { userId: user.id, type: "series", isAnime: false, isArabic: false, isFollowing: true },
      orderBy: { addedAt: "desc" },
    });
    return NextResponse.json({ items: items.map(toCompat), source: "Media" });
  } catch (error) {
    console.error("[following:GET]", error);
    return NextResponse.json({ error: "Failed to load followed shows" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await getOrCreateUser(parseUserId(req));
    const body = await req.json();
    const tmdbId = Number(body.tmdbId);
    if (!Number.isInteger(tmdbId) || tmdbId <= 0 || !body.title) {
      return NextResponse.json({ error: "tmdbId, title required", changed: false }, { status: 400 });
    }

    const identity = { userId: user.id, type: "series", tmdbId };
    const normalizedPoster = canonicalMediaPoster(body.posterPath);
    const [existing, watchedEpisodes] = await Promise.all([
      db.media.findUnique({ where: { userId_type_tmdbId: identity } }),
      db.watchedEpisode.count({ where: { userId: user.id, showId: tmdbId } }),
    ]);
    const activeStates = new Set(["not_started", "watching", "uptodate", "finished"]);
    const nextStatus = existing?.status && activeStates.has(existing.status)
      ? existing.status
      : watchedEpisodes > 0 ? "watching" : "not_started";
    const changed = !existing || !existing.isFollowing || existing.status !== nextStatus;

    const item = await db.media.upsert({
      where: { userId_type_tmdbId: identity },
      create: {
        userId: user.id,
        tmdbId,
        title: String(body.title),
        type: "series",
        poster: normalizedPoster,
        status: nextStatus,
        isFollowing: true,
        watched: false,
      },
      update: {
        title: String(body.title),
        ...(normalizedPoster ? { poster: normalizedPoster } : {}),
        status: nextStatus,
        isFollowing: true,
      },
    });

    return NextResponse.json({ item: toCompat(item), changed, source: "Media" });
  } catch (error) {
    console.error("[following:POST]", error);
    return NextResponse.json({ error: "Failed to follow show", changed: false }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const user = await getOrCreateUser(parseUserId(req));
    const tmdbId = Number(new URL(req.url).searchParams.get("tmdbId"));
    if (!Number.isInteger(tmdbId) || tmdbId <= 0) {
      return NextResponse.json({ error: "tmdbId required", changed: false }, { status: 400 });
    }

    const result = await db.media.updateMany({
      where: { userId: user.id, type: "series", tmdbId, isFollowing: true },
      data: { isFollowing: false },
    });

    return NextResponse.json({
      ok: true,
      changed: result.count > 0,
      updated: result.count,
      source: "Media",
    });
  } catch (error) {
    console.error("[following:DELETE]", error);
    return NextResponse.json({ error: "Failed to unfollow show", changed: false }, { status: 500 });
  }
}
