import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getOrCreateUser, parseUserId } from "@/lib/user";

// GET - list watched episodes (optionally filter by showId)
export async function GET(req: NextRequest) {
  const userId = parseUserId(req);
  if (!userId) return NextResponse.json({ error: "userId required" }, { status: 400 });

  const url = new URL(req.url);
  const showId = url.searchParams.get("showId");

  const user = await getOrCreateUser(userId);
  const items = await db.watchedEpisode.findMany({
    where: {
      userId: user.id,
      ...(showId ? { showId: Number(showId) } : {}),
    },
    orderBy: { watchedAt: "desc" },
  });
  return NextResponse.json({ items });
}

// POST - mark episode as watched (supports bulk via episodes array)
export async function POST(req: NextRequest) {
  const userId = parseUserId(req);
  if (!userId) return NextResponse.json({ error: "userId required" }, { status: 400 });

  const body = await req.json();
  const user = await getOrCreateUser(userId);

  // Bulk mode
  if (Array.isArray(body.episodes)) {
    const showId = Number(body.showId);
    if (!showId) return NextResponse.json({ error: "showId required for bulk" }, { status: 400 });

    const data = body.episodes.map((e: { seasonNumber: number; episodeNumber: number; episodeName?: string }) => ({
      userId: user.id,
      showId,
      seasonNumber: Number(e.seasonNumber),
      episodeNumber: Number(e.episodeNumber),
      episodeName: e.episodeName || null,
    }));

    // Upsert each
    await Promise.all(
      data.map((d: any) =>
        db.watchedEpisode.upsert({
          where: {
            userId_showId_seasonNumber_episodeNumber: {
              userId: d.userId,
              showId: d.showId,
              seasonNumber: d.seasonNumber,
              episodeNumber: d.episodeNumber,
            },
          },
          create: d,
          update: { episodeName: d.episodeName },
        })
      )
    );
    return NextResponse.json({ ok: true, count: data.length });
  }

  // Single mode
  const { showId, seasonNumber, episodeNumber, episodeName } = body;
  if (!showId || seasonNumber == null || episodeNumber == null) {
    return NextResponse.json({ error: "showId, seasonNumber, episodeNumber required" }, { status: 400 });
  }

  const item = await db.watchedEpisode.upsert({
    where: {
      userId_showId_seasonNumber_episodeNumber: {
        userId: user.id,
        showId: Number(showId),
        seasonNumber: Number(seasonNumber),
        episodeNumber: Number(episodeNumber),
      },
    },
    create: {
      userId: user.id,
      showId: Number(showId),
      seasonNumber: Number(seasonNumber),
      episodeNumber: Number(episodeNumber),
      episodeName: episodeName || null,
    },
    update: {},
  });
  return NextResponse.json({ item });
}

// DELETE - remove watched episode
export async function DELETE(req: NextRequest) {
  const userId = parseUserId(req);
  if (!userId) return NextResponse.json({ error: "userId required" }, { status: 400 });

  const url = new URL(req.url);
  const showId = url.searchParams.get("showId");
  const seasonNumber = url.searchParams.get("seasonNumber");
  const episodeNumber = url.searchParams.get("episodeNumber");

  if (!showId || seasonNumber == null || episodeNumber == null) {
    return NextResponse.json({ error: "showId, seasonNumber, episodeNumber required" }, { status: 400 });
  }

  const user = await getOrCreateUser(userId);
  await db.watchedEpisode.deleteMany({
    where: {
      userId: user.id,
      showId: Number(showId),
      seasonNumber: Number(seasonNumber),
      episodeNumber: Number(episodeNumber),
    },
  });
  return NextResponse.json({ ok: true });
}
