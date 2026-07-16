import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { enforceAdminSecret } from "@/lib/admin-guard";

// Read-only by default. This legacy repair may use rating=75 only as a search
// signature, but it never changes the rating. TVM-03 forbids a watch-state
// repair from adding or removing a rating.
export async function GET(req: NextRequest) {
  // TVM-40: Always enforce admin secret
  const guard = enforceAdminSecret(req);
  if (guard) return guard;

  try {
    const apply = req.nextUrl.searchParams.get("apply") === "true";
    const candidates = await db.media.findMany({
      where: { type: "movie", watched: true, userRating: 75, status: "watched" },
      select: { id: true, tmdbId: true, title: true, userRating: true, status: true, watchedAt: true },
    });

    let resetWatchState = 0;
    if (apply) {
      for (const candidate of candidates) {
        await db.media.update({
          where: { id: candidate.id },
          data: {
            watched: false,
            watchedAt: null,
            status: null,
            // userRating is deliberately preserved. A rating-only item is not
            // silently placed into Watchlist.
          },
        });
        resetWatchState++;
      }
    }

    return NextResponse.json({
      ok: true,
      dryRun: !apply,
      resetWatchState,
      ratingChanges: 0,
      candidates,
    });
  } catch (error: any) {
    console.error("[admin:reset-accidental-watched]", error);
    return NextResponse.json({ error: error?.message || "Failed" }, { status: 500 });
  }
}
