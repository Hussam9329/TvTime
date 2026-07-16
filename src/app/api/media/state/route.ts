import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getOrCreateUser, parseUserId } from "@/lib/user";
import { normalizeMedia } from "@/lib/media-normalize";

/**
 * Direct canonical state lookup by user + media type + TMDB identity.
 *
 * GET /api/media/state?tmdbId=123&type=movie
 * -> { item: { id, watched, status, userRating, isFollowing, ... } | null }
 */
export async function GET(req: NextRequest) {
  try {
    const user = await getOrCreateUser(parseUserId(req));
    const url = new URL(req.url);
    const tmdbId = Number(url.searchParams.get("tmdbId"));
    const typeParam = url.searchParams.get("type") || "movie";
    const mediaType = typeParam === "tv" || typeParam === "series"
      ? "series"
      : typeParam === "movie" ? "movie" : null;

    if (!Number.isInteger(tmdbId) || tmdbId <= 0 || !mediaType) {
      return NextResponse.json({ error: "Valid tmdbId and media type are required" }, { status: 400 });
    }

    const item = await db.media.findUnique({
      where: {
        userId_type_tmdbId: {
          userId: user.id,
          type: mediaType,
          tmdbId,
        },
      },
    });

    return NextResponse.json({ item: item ? normalizeMedia(item) : null, duplicateCount: 0 });
  } catch (error) {
    console.error("[media:state]", error);
    return NextResponse.json({ error: "Failed to load media state" }, { status: 500 });
  }
}
