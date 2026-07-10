import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { ACTIVE_TV_STATES } from "@/lib/library-counts";
import { getOrCreateUser, parseUserId } from "@/lib/user";

function toCompat(item: any) {
  return { ...item, posterPath: item.poster, followedAt: item.addedAt };
}

// Compatibility endpoint backed only by Media tracking states.
export async function GET(req: NextRequest) {
  try {
    const user = await getOrCreateUser(parseUserId(req));
    const items = await db.media.findMany({
      where: { userId: user.id, type: "series", status: { in: [...ACTIVE_TV_STATES] } },
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
      return NextResponse.json({ error: "tmdbId, title required" }, { status: 400 });
    }

    let item = await db.media.findFirst({ where: { userId: user.id, type: "series", tmdbId } });
    if (!item) {
      item = await db.media.create({
        data: {
          userId: user.id,
          tmdbId,
          title: String(body.title),
          type: "series",
          poster: body.posterPath || null,
          status: "not_started",
          watched: false,
        },
      });
    } else {
      const watchedEpisodes = await db.watchedEpisode.count({ where: { userId: user.id, showId: tmdbId } });
      const canSetNotStarted = !item.watched && watchedEpisodes === 0 && (!item.status || item.status === "planned");
      item = await db.media.update({
        where: { id: item.id },
        data: {
          title: String(body.title),
          ...(body.posterPath ? { poster: body.posterPath } : {}),
          ...(canSetNotStarted ? { status: "not_started" } : {}),
        },
      });
    }

    return NextResponse.json({ item: toCompat(item), source: "Media" });
  } catch (error) {
    console.error("[following:POST]", error);
    return NextResponse.json({ error: "Failed to follow show" }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const user = await getOrCreateUser(parseUserId(req));
    const tmdbId = Number(new URL(req.url).searchParams.get("tmdbId"));
    if (!Number.isInteger(tmdbId) || tmdbId <= 0) {
      return NextResponse.json({ error: "tmdbId required" }, { status: 400 });
    }

    const watchedEpisodes = await db.watchedEpisode.count({ where: { userId: user.id, showId: tmdbId } });
    const result = watchedEpisodes === 0
      ? await db.media.updateMany({
          where: { userId: user.id, type: "series", tmdbId, status: "not_started", watched: false },
          data: { status: null },
        })
      : { count: 0 };

    return NextResponse.json({ ok: true, updated: result.count, preservedProgress: watchedEpisodes > 0, source: "Media" });
  } catch (error) {
    console.error("[following:DELETE]", error);
    return NextResponse.json({ error: "Failed to unfollow show" }, { status: 500 });
  }
}
