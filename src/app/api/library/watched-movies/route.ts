import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getOrCreateUser } from "@/lib/user";
import { resolveUserId } from "@/lib/auth";

function toCompat(item: any) {
  return {
    ...item,
    posterPath: item.poster,
  };
}

// Compatibility endpoint backed only by Media. Completed movies always carry
// their required personal rating on the canonical row.
export async function GET(req: NextRequest) {
  try {
    const user = await getOrCreateUser(await resolveUserId(req));
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
    const user = await getOrCreateUser(await resolveUserId(req));
    const body = await req.json();
    const tmdbId = Number(body.tmdbId);
    if (!Number.isInteger(tmdbId) || tmdbId <= 0 || !body.title) {
      return NextResponse.json({ error: "tmdbId, title required" }, { status: 400 });
    }
    const suppliedRating = body.userRating;
    if (suppliedRating !== undefined
      && (typeof suppliedRating !== "number" || !Number.isInteger(suppliedRating) || suppliedRating < 0 || suppliedRating > 100)) {
      return NextResponse.json(
        { error: "User rating must be a whole number from 0 to 100.", code: "INVALID_USER_RATING" },
        { status: 400 },
      );
    }

    const identity = { userId: user.id, type: "movie", tmdbId };
    const existing = await db.media.findUnique({ where: { userId_type_tmdbId: identity } });
    const userRating = suppliedRating === undefined ? existing?.userRating : suppliedRating;
    if (typeof userRating !== "number" || !Number.isInteger(userRating) || userRating < 0 || userRating > 100) {
      return NextResponse.json(
        {
          error: "Marking a movie watched requires your rating from 0 to 100.",
          code: "MOVIE_WATCHED_REQUIRES_RATING",
        },
        { status: 400 },
      );
    }

    const data = {
      title: String(body.title),
      poster: body.posterPath || existing?.poster || null,
      runtime: body.runtime != null ? Number(body.runtime) : existing?.runtime || null,
      watched: true,
      watchedAt: new Date(),
      status: "watched",
      userRating,
    };
    const item = await db.media.upsert({
      where: { userId_type_tmdbId: identity },
      create: { userId: user.id, tmdbId, type: "movie", ...data },
      update: data,
    });

    return NextResponse.json({ item: toCompat(item), source: "Media" });
  } catch (error) {
    console.error("[watched-movies:POST]", error);
    return NextResponse.json({ error: "Failed to mark movie watched" }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const user = await getOrCreateUser(await resolveUserId(req));
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
