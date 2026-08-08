import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getOrCreateUser } from "@/lib/user";
import { resolveUserId } from "@/lib/auth";
import { normalizeMedia } from "@/lib/media-normalize";
import { resolveGeneralMediaClassifications } from "@/lib/media-classification-resolver-server";

/**
 * Direct canonical state lookup by user + media type + TMDB identity.
 *
 * GET /api/media/state?tmdbId=123&type=movie
 * -> { item: { id, watched, status, userRating, isFollowing, ... } | null }
 */
export async function GET(req: NextRequest) {
  try {
    const user = await getOrCreateUser(await resolveUserId(req));
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

    const [classifiedItem] = item
      ? await resolveGeneralMediaClassifications([item], { allowNetwork: false })
      : [];
    return NextResponse.json({
      item: classifiedItem ? normalizeMedia(classifiedItem) : null,
      duplicateCount: 0,
    });
  } catch (error) {
    console.error("[media:state]", error);
    return NextResponse.json({ error: "Failed to load media state" }, { status: 500 });
  }
}
