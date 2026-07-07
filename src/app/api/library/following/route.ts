import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getOrCreateUser, parseUserId } from "@/lib/user";

// GET - list followed shows
export async function GET(req: NextRequest) {
  const userId = parseUserId(req);
  if (!userId) return NextResponse.json({ error: "userId required" }, { status: 400 });

  const user = await getOrCreateUser(userId);
  const items = await db.followingShow.findMany({
    where: { userId: user.id },
    orderBy: { followedAt: "desc" },
  });
  return NextResponse.json({ items });
}

// POST - follow a show
export async function POST(req: NextRequest) {
  const userId = parseUserId(req);
  if (!userId) return NextResponse.json({ error: "userId required" }, { status: 400 });

  const body = await req.json();
  const { tmdbId, title, posterPath } = body;
  if (!tmdbId || !title) {
    return NextResponse.json({ error: "tmdbId, title required" }, { status: 400 });
  }

  const user = await getOrCreateUser(userId);
  const item = await db.followingShow.upsert({
    where: {
      userId_tmdbId: { userId: user.id, tmdbId: Number(tmdbId) },
    },
    create: {
      userId: user.id,
      tmdbId: Number(tmdbId),
      title,
      posterPath: posterPath || null,
    },
    update: { title },
  });
  return NextResponse.json({ item });
}

// DELETE - unfollow a show
export async function DELETE(req: NextRequest) {
  const userId = parseUserId(req);
  if (!userId) return NextResponse.json({ error: "userId required" }, { status: 400 });

  const url = new URL(req.url);
  const tmdbId = url.searchParams.get("tmdbId");
  if (!tmdbId) return NextResponse.json({ error: "tmdbId required" }, { status: 400 });

  const user = await getOrCreateUser(userId);
  await db.followingShow.deleteMany({
    where: { userId: user.id, tmdbId: Number(tmdbId) },
  });
  return NextResponse.json({ ok: true });
}
