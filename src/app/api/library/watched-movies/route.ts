import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getOrCreateUser } from "@/lib/user";
import { resolveUserId } from "@/lib/auth";
import { validatePersonalRatingBreakdown } from "@/lib/personal-rating";

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
    if (body.userRating !== undefined) {
      return NextResponse.json(
        {
          error: "Whole-title ratings must be submitted through the 10 personal rating criteria.",
          code: "STRUCTURED_RATING_REQUIRED",
        },
        { status: 400 },
      );
    }

    const identity = { userId: user.id, type: "movie", tmdbId };
    const existing = await db.media.findUnique({ where: { userId_type_tmdbId: identity } });
    const ratingValidation = body.ratingBreakdown === undefined
      ? null
      : validatePersonalRatingBreakdown(body.ratingBreakdown, "movie");
    if (ratingValidation && !ratingValidation.ok) {
      return NextResponse.json(
        { error: ratingValidation.error, code: "INVALID_RATING_BREAKDOWN" },
        { status: 400 },
      );
    }
    const userRating = ratingValidation?.ok ? ratingValidation.score : existing?.userRating;
    if (typeof userRating !== "number" || !Number.isInteger(userRating) || userRating < 0 || userRating > 100) {
      return NextResponse.json(
        {
          error: "Marking a new movie watched requires all 10 personal rating criteria.",
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
      ...(ratingValidation?.ok ? { ratingBreakdown: ratingValidation.breakdown } : {}),
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
