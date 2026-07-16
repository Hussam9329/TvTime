import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getOrCreateUser, parseUserId } from "@/lib/user";

const MAX_ITEMS = 200;

type RequestedState = {
  tmdbId: number;
  mediaType: "movie" | "tv";
};

function keyFor(mediaType: "movie" | "tv", tmdbId: number) {
  return `${mediaType}:${tmdbId}`;
}

function completenessScore(item: {
  watched: boolean;
  userRating: number | null;
  status: string | null;
  poster: string | null;
  overview: string | null;
  updatedAt: Date;
}) {
  return Number(item.watched) * 1000
    + Number(item.userRating != null) * 500
    + Number(item.status != null) * 300
    + Number(item.poster != null) * 40
    + Number(item.overview != null) * 30
    + item.updatedAt.getTime() / 1e15;
}

export async function POST(req: NextRequest) {
  try {
    const user = await getOrCreateUser(parseUserId(req));
    const body = await req.json();
    if (!Array.isArray(body?.items)) {
      return NextResponse.json({ error: "items array required" }, { status: 400 });
    }

    if (body.items.length > MAX_ITEMS) {
      return NextResponse.json({ error: `A maximum of ${MAX_ITEMS} media states can be requested` }, { status: 413 });
    }

    const deduped = new Map<string, RequestedState>();
    for (const raw of body.items) {
      const tmdbId = Number(raw?.tmdbId);
      const mediaType = raw?.mediaType === "tv" ? "tv" : raw?.mediaType === "movie" ? "movie" : null;
      if (!mediaType || !Number.isInteger(tmdbId) || tmdbId <= 0) continue;
      deduped.set(keyFor(mediaType, tmdbId), { tmdbId, mediaType });
    }


    const requested = [...deduped.values()];
    if (requested.length === 0) {
      return NextResponse.json({ states: {} });
    }

    const rows = await db.media.findMany({
      where: {
        userId: user.id,
        OR: requested.map((item) => ({
          tmdbId: item.tmdbId,
          type: item.mediaType === "tv" ? "series" : "movie",
        })),
      },
      select: {
        id: true,
        tmdbId: true,
        type: true,
        status: true,
        watched: true,
        userRating: true,
        isAnime: true,
        isArabic: true,
        originalLanguage: true,
        originCountries: true,
        isFollowing: true,
        poster: true,
        overview: true,
        updatedAt: true,
      },
    });

    // The migration makes duplicates impossible. Until it is applied, select the
    // strongest existing row so cards remain deterministic during rollout.
    const bestByKey = new Map<string, (typeof rows)[number]>();
    for (const row of rows) {
      if (row.tmdbId == null || (row.type !== "movie" && row.type !== "series")) continue;
      const mediaType = row.type === "series" ? "tv" : "movie";
      const key = keyFor(mediaType, row.tmdbId);
      const current = bestByKey.get(key);
      if (!current || completenessScore(row) > completenessScore(current)) bestByKey.set(key, row);
    }

    const states: Record<string, unknown> = {};
    for (const [key, row] of bestByKey) {
      states[key] = {
        id: row.id,
        tmdbId: row.tmdbId,
        type: row.type,
        status: row.status,
        watched: row.watched,
        userRating: row.userRating,
        isAnime: row.isAnime,
        isArabic: row.isArabic,
        originalLanguage: row.originalLanguage,
        originCountries: row.originCountries,
        inWatchlist: row.status === "planned" && !row.watched,
        isFollowing: row.type === "series" && row.isFollowing,
      };
    }

    return NextResponse.json({ states });
  } catch (error) {
    console.error("[media:states]", error);
    return NextResponse.json({ error: "Failed to load media states" }, { status: 500 });
  }
}
