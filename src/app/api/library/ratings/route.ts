import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getOrCreateUser, parseUserId } from "@/lib/user";

// GET - list user's ratings (optionally filter by mediaType)
export async function GET(req: NextRequest) {
  const userId = parseUserId(req);
  if (!userId) return NextResponse.json({ error: "userId required" }, { status: 400 });

  const url = new URL(req.url);
  const mediaType = url.searchParams.get("mediaType");

  const user = await getOrCreateUser(userId);
  const items = await db.rating.findMany({
    where: {
      userId: user.id,
      ...(mediaType ? { mediaType } : {}),
    },
    orderBy: { updatedAt: "desc" },
  });
  return NextResponse.json({ items });
}

// POST - set a rating (upsert)
export async function POST(req: NextRequest) {
  const userId = parseUserId(req);
  if (!userId) return NextResponse.json({ error: "userId required" }, { status: 400 });

  const body = await req.json();
  const { mediaType, tmdbId, value, title, posterPath } = body;
  if (!mediaType || !tmdbId || value == null) {
    return NextResponse.json({ error: "mediaType, tmdbId, value required" }, { status: 400 });
  }

  const v = Math.max(1, Math.min(10, Number(value)));
  const user = await getOrCreateUser(userId);
  const item = await db.rating.upsert({
    where: {
      userId_mediaType_tmdbId: { userId: user.id, mediaType, tmdbId: Number(tmdbId) },
    },
    create: {
      userId: user.id,
      mediaType,
      tmdbId: Number(tmdbId),
      title: title || `Unknown`,
      posterPath: posterPath || null,
      value: v,
    },
    update: {
      value: v,
      ...(title ? { title } : {}),
      ...(posterPath !== undefined ? { posterPath } : {}),
    },
  });
  return NextResponse.json({ item });
}

// DELETE - remove a rating
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
  await db.rating.deleteMany({
    where: { userId: user.id, mediaType, tmdbId: Number(tmdbId) },
  });
  return NextResponse.json({ ok: true });
}
