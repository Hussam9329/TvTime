import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getOrCreateUser, parseUserId } from "@/lib/user";

// GET - list watched movies
export async function GET(req: NextRequest) {
  const userId = parseUserId(req);
  if (!userId) return NextResponse.json({ error: "userId required" }, { status: 400 });

  const user = await getOrCreateUser(userId);
  const items = await db.watchedMovie.findMany({
    where: { userId: user.id },
    orderBy: { watchedAt: "desc" },
  });
  return NextResponse.json({ items });
}

// POST - mark movie as watched
export async function POST(req: NextRequest) {
  const userId = parseUserId(req);
  if (!userId) return NextResponse.json({ error: "userId required" }, { status: 400 });

  const body = await req.json();
  const { tmdbId, title, posterPath, runtime } = body;
  if (!tmdbId || !title) {
    return NextResponse.json({ error: "tmdbId, title required" }, { status: 400 });
  }

  const user = await getOrCreateUser(userId);
  const item = await db.watchedMovie.upsert({
    where: {
      userId_tmdbId: { userId: user.id, tmdbId: Number(tmdbId) },
    },
    create: {
      userId: user.id,
      tmdbId: Number(tmdbId),
      title,
      posterPath: posterPath || null,
      runtime: runtime || null,
    },
    update: {
      title,
      posterPath: posterPath || null,
    },
  });
  return NextResponse.json({ item });
}

// DELETE - remove from watched
export async function DELETE(req: NextRequest) {
  const userId = parseUserId(req);
  if (!userId) return NextResponse.json({ error: "userId required" }, { status: 400 });

  const url = new URL(req.url);
  const tmdbId = url.searchParams.get("tmdbId");
  if (!tmdbId) return NextResponse.json({ error: "tmdbId required" }, { status: 400 });

  const user = await getOrCreateUser(userId);
  await db.watchedMovie.deleteMany({
    where: { userId: user.id, tmdbId: Number(tmdbId) },
  });
  return NextResponse.json({ ok: true });
}
