import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getOrCreateUser, parseUserId } from "@/lib/user";

function toCompat(item: any) {
  return {
    ...item,
    posterPath: item.poster,
  };
}

// Compatibility endpoint backed only by Media. Rating remains independent.
export async function GET(req: NextRequest) {
  try {
    const user = await getOrCreateUser(parseUserId(req));
    const items = await db.media.findMany({
      where: { userId: user.id, type: "movie", watched: true },
      orderBy: [{ watchedAt: "desc" }, { updatedAt: "desc" }],
    });
    return NextResponse.json({ items: items.map(toCompat), source: "Media" });
  } catch (error) {
    console.error("[watched-movies:GET]", error);
    return NextResponse.json({ error: "Failed to load watched movies" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await getOrCreateUser(parseUserId(req));
    const body = await req.json();
    const tmdbId = Number(body.tmdbId);
    if (!Number.isInteger(tmdbId) || tmdbId <= 0 || !body.title) {
      return NextResponse.json({ error: "tmdbId, title required" }, { status: 400 });
    }

    let item = await db.media.findFirst({ where: { userId: user.id, type: "movie", tmdbId } });
    const data = {
      title: String(body.title),
      poster: body.posterPath || item?.poster || null,
      runtime: body.runtime != null ? Number(body.runtime) : item?.runtime || null,
      watched: true,
      watchedAt: new Date(),
      status: "watched",
    };
    item = item
      ? await db.media.update({ where: { id: item.id }, data })
      : await db.media.create({ data: { userId: user.id, tmdbId, type: "movie", ...data } });

    return NextResponse.json({ item: toCompat(item), source: "Media" });
  } catch (error) {
    console.error("[watched-movies:POST]", error);
    return NextResponse.json({ error: "Failed to mark movie watched" }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const user = await getOrCreateUser(parseUserId(req));
    const tmdbId = Number(new URL(req.url).searchParams.get("tmdbId"));
    if (!Number.isInteger(tmdbId) || tmdbId <= 0) {
      return NextResponse.json({ error: "tmdbId required" }, { status: 400 });
    }

    const result = await db.media.updateMany({
      where: { userId: user.id, type: "movie", tmdbId, watched: true },
      data: { watched: false, watchedAt: null, status: null },
    });
    return NextResponse.json({ ok: true, updated: result.count, source: "Media" });
  } catch (error) {
    console.error("[watched-movies:DELETE]", error);
    return NextResponse.json({ error: "Failed to remove movie from watched" }, { status: 500 });
  }
}
