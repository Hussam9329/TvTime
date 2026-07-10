import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getOrCreateUser, parseUserId } from "@/lib/user";

// GET - list user's watchlist (optionally filter by mediaType)
export async function GET(req: NextRequest) {
  const userId = parseUserId(req);
  if (!userId) return NextResponse.json({ error: "userId required" }, { status: 400 });

  const url = new URL(req.url);
  const mediaType = url.searchParams.get("mediaType");

  const user = await getOrCreateUser(userId);
  const items = await db.watchlistItem.findMany({
    where: {
      userId: user.id,
      ...(mediaType ? { mediaType } : {}),
    },
    orderBy: { addedAt: "desc" },
  });
  return NextResponse.json({ items });
}

// POST - add to watchlist
export async function POST(req: NextRequest) {
  const userId = parseUserId(req);
  if (!userId) return NextResponse.json({ error: "userId required" }, { status: 400 });

  const body = await req.json();
  const { mediaType, tmdbId, title, posterPath, backdropPath, overview, releaseDate, voteAverage } = body;
  if (!mediaType || !tmdbId || !title) {
    return NextResponse.json({ error: "mediaType, tmdbId, title required" }, { status: 400 });
  }

  const user = await getOrCreateUser(userId);
  const item = await db.watchlistItem.upsert({
    where: {
      userId_mediaType_tmdbId: { userId: user.id, mediaType, tmdbId: Number(tmdbId) },
    },
    create: {
      userId: user.id,
      mediaType,
      tmdbId: Number(tmdbId),
      title,
      posterPath: posterPath || null,
      backdropPath: backdropPath || null,
      overview: overview || null,
      releaseDate: releaseDate || null,
      voteAverage: voteAverage || null,
    },
    update: {
      title,
      posterPath: posterPath || null,
      backdropPath: backdropPath || null,
    },
  });
  return NextResponse.json({ item });
}

// DELETE - remove from watchlist
export async function DELETE(req: NextRequest) {
  const userId = parseUserId(req);
  if (!userId) return NextResponse.json({ error: "userId required" }, { status: 400 });

  const url = new URL(req.url);
  const mediaType = url.searchParams.get("mediaType");
  const tmdbId = url.searchParams.get("tmdbId");
  if (!mediaType || !tmdbId) {
    return NextResponse.json({ error: "mediaType, tmdbId required" }, { status: 400 });
  }

  const user = await getOrCreateUser(userId);
  await db.watchlistItem.deleteMany({
    where: {
      userId: user.id,
      mediaType,
      tmdbId: Number(tmdbId),
    },
  });
  return NextResponse.json({ ok: true });
}
