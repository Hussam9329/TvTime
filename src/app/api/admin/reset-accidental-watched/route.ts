import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

// Reset "accidental" watched movies back to the watchlist.
//
// A movie is considered accidental if ALL of these are true:
//   - watched = true
//   - userRating = 75 (the old RatingDialog default that was too easy to save)
//   - status = "watched" (legacy value from the old useRatingMutate "set" path)
//
// Such rows almost always came from a user clicking "Rate & Watch" in the
// Library view and accepting the default 75 without meaning to. The new
// RatingDialog defaults to 50 and clearer copy, so this won't keep happening.
//
// Endpoint is idempotent and safe to call multiple times. Optional protection
// via ADMIN_REPAIR_SECRET (same secret used by /api/admin/repair-posters).

export async function GET(req: NextRequest) {
  const expectedSecret = process.env.ADMIN_REPAIR_SECRET;
  if (expectedSecret) {
    const provided = req.nextUrl.searchParams.get("secret");
    if (provided !== expectedSecret) {
      return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    }
  }

  try {
    // Find candidates: movies with the suspicious "default 75 + status watched" signature.
    const candidates = await db.media.findMany({
      where: {
        type: "movie",
        watched: true,
        userRating: 75,
        status: "watched",
      },
      select: { id: true, tmdbId: true, title: true, userRating: true, status: true, watchedAt: true },
    });

    let reset = 0;
    for (const c of candidates) {
      await db.media.update({
        where: { id: c.id },
        data: {
          watched: false,
          watchedAt: null,
          userRating: null,
          status: "planned", // back to watchlist
        },
      });
      reset++;
      console.log(`reset accidental watched: ${c.title} (tmdbId=${c.tmdbId})`);
    }

    return NextResponse.json({
      ok: true,
      reset,
      candidates: candidates.map((c) => ({ id: c.id, tmdbId: c.tmdbId, title: c.title, watchedAt: c.watchedAt })),
    });
  } catch (error: any) {
    console.error("[admin:reset-accidental-watched]", error);
    return NextResponse.json({ error: error?.message || "Failed" }, { status: 500 });
  }
}
