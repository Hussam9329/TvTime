import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getOrCreateUser, parseUserId } from "@/lib/user";
import { canonicalMediaPoster } from "@/lib/media-poster";

function canonicalType(mediaType: string | null) {
  return mediaType === "tv" || mediaType === "series" ? "series" : mediaType === "movie" ? "movie" : null;
}

function toCompat(item: any) {
  return {
    ...item,
    mediaType: item.type === "series" ? "tv" : item.type,
    posterPath: item.poster,
    releaseDate: item.year ? `${item.year}-01-01` : null,
    voteAverage: item.rating == null ? null : Number(item.rating),
  };
}

// Compatibility endpoint backed only by Media. The legacy WatchlistItem table
// is migrated/cleaned by TVM-10 and is never read here.
export async function GET(req: NextRequest) {
  try {
    const user = await getOrCreateUser(parseUserId(req));
    const type = canonicalType(new URL(req.url).searchParams.get("mediaType"));
    const items = await db.media.findMany({
      where: {
        userId: user.id,
        status: "planned",
        watched: false,
        ...(type ? { type } : {}),
      },
      orderBy: { addedAt: "desc" },
    });
    return NextResponse.json({ items: items.map(toCompat), source: "Media" });
  } catch (error) {
    console.error("[watchlist:GET]", error);
    return NextResponse.json({ error: "Failed to load watchlist" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await getOrCreateUser(parseUserId(req));
    const body = await req.json();
    const type = canonicalType(body.mediaType);
    const tmdbId = Number(body.tmdbId);
    if (!type || !Number.isInteger(tmdbId) || tmdbId <= 0 || !body.title) {
      return NextResponse.json({ error: "mediaType, tmdbId, title required" }, { status: 400 });
    }

    const identity = { userId: user.id, type, tmdbId };
    const normalizedPoster = canonicalMediaPoster(body.posterPath);
    let item = await db.media.findUnique({ where: { userId_type_tmdbId: identity } });
    if (item?.watched || (type === "series" && item?.status && item.status !== "planned")) {
      return NextResponse.json(
        { error: "A watched or actively tracked title cannot also be in Watchlist.", code: "WATCHLIST_REQUIRES_PLANNED" },
        { status: 409 },
      );
    }

    const common = {
      title: String(body.title),
      poster: normalizedPoster,
      overview: body.overview || null,
      year: body.releaseDate ? String(body.releaseDate).slice(0, 4) : null,
      rating: body.voteAverage != null ? String(body.voteAverage) : null,
      status: "planned",
      watched: false,
      watchedAt: null,
      ...(type === "series" ? { isFollowing: false } : {}),
    };

    item = await db.media.upsert({
      where: { userId_type_tmdbId: identity },
      create: { userId: user.id, tmdbId, type, ...common },
      update: { ...common, ...(item?.poster ? { poster: item.poster } : {}) },
    });

    return NextResponse.json({ item: toCompat(item), source: "Media" });
  } catch (error) {
    console.error("[watchlist:POST]", error);
    return NextResponse.json({ error: "Failed to add to watchlist" }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const user = await getOrCreateUser(parseUserId(req));
    const url = new URL(req.url);
    const type = canonicalType(url.searchParams.get("mediaType"));
    const tmdbId = Number(url.searchParams.get("tmdbId"));
    if (!type || !Number.isInteger(tmdbId) || tmdbId <= 0) {
      return NextResponse.json({ error: "mediaType, tmdbId required" }, { status: 400 });
    }

    const result = await db.media.updateMany({
      where: { userId: user.id, type, tmdbId, status: "planned", watched: false },
      data: { status: null },
    });
    return NextResponse.json({ ok: true, updated: result.count, source: "Media" });
  } catch (error) {
    console.error("[watchlist:DELETE]", error);
    return NextResponse.json({ error: "Failed to remove from watchlist" }, { status: 500 });
  }
}
