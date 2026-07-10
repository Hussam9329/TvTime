import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getOrCreateUser, parseUserId } from "@/lib/user";
import { normalizeMedia } from "@/lib/media-normalize";

/**
 * TVM Fix: Direct state lookup by userId + type + tmdbId.
 *
 * Returns the canonical state of a single media item without paginating
 * through the entire library. This fixes the bug where detail pages
 * couldn't find items beyond the first 100 in the watchlist/watched list.
 *
 * GET /api/media/state?tmdbId=123&type=movie
 * → { item: { id, watched, status, userRating, ... } | null }
 */
export async function GET(req: NextRequest) {
  try {
    const user = await getOrCreateUser(parseUserId(req));
    const url = new URL(req.url);
    const tmdbId = Number(url.searchParams.get("tmdbId"));
    const typeParam = url.searchParams.get("type") || "movie";
    const mediaType = typeParam === "tv" ? "series" : typeParam;

    if (!Number.isFinite(tmdbId) || tmdbId <= 0) {
      return NextResponse.json({ error: "Valid tmdbId required" }, { status: 400 });
    }

    // Find ALL matching rows (may have duplicates — return the most complete one)
    const items = await db.media.findMany({
      where: { userId: user.id, tmdbId, type: mediaType },
      orderBy: { updatedAt: "desc" },
    });

    if (items.length === 0) {
      return NextResponse.json({ item: null });
    }

    // If duplicates exist, merge them into the strongest representation
    // (most data wins: watched=true, highest rating, most recent dates)
    let best = items[0];
    for (const item of items) {
      if (item.watched && !best.watched) best = item;
      if (item.userRating != null && (best.userRating == null || item.userRating > best.userRating)) {
        best = item;
      }
      if (item.status && !best.status) best = item;
    }

    return NextResponse.json({ item: normalizeMedia(best), duplicateCount: items.length > 1 ? items.length : 0 });
  } catch (error) {
    console.error("[media:state]", error);
    return NextResponse.json({ error: "Failed to load media state" }, { status: 500 });
  }
}
