import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { enforceAdminSecret } from "@/lib/admin-guard";

// One-time data backfill: aligns HISTORICAL movie data with the user's actual
// intent. Before TVM-03, the app treated "has a rating" as "watched", so users
// rated movies they watched without the `watched` flag being set. TVM-03
// correctly separated rating from watch — but that means ~2185 rated movies
// that the user actually watched disappeared from the Watched tab.
//
// This endpoint sets watched=true for movies that have a userRating but are
// not currently marked watched. It is:
//   - Idempotent (safe to run multiple times)
//   - Movies only (TV shows have their own state engine)
//   - Does NOT delete or modify any ratings
//   - Does NOT touch the schema (no migration/db push)
//   - Sets watchedAt to the existing updatedAt/addedAt (best-effort timestamp)
//
// TVM-40: Always enforces ADMIN_REPAIR_SECRET.

export async function GET(req: NextRequest) {
  const guard = enforceAdminSecret(req);
  if (guard) return guard;

  try {
    // Find all movies that have a rating but are NOT marked watched.
    // These are the "disappeared" movies — the user rated them (meaning they
    // watched them) but the watched flag was never set.
    const candidates = await db.media.findMany({
      where: {
        type: "movie",
        watched: false,
        userRating: { not: null },
      },
      select: {
        id: true,
        title: true,
        tmdbId: true,
        userRating: true,
        watchedAt: true,
        updatedAt: true,
        addedAt: true,
      },
    });

    let updated = 0;
    const sampleUpdates: { title: string; tmdbId: number | null; rating: number | null }[] = [];

    for (const movie of candidates) {
      // Best-effort watchedAt: use existing watchedAt, else updatedAt, else addedAt
      const watchedAt = movie.watchedAt ?? movie.updatedAt ?? movie.addedAt;
      await db.media.update({
        where: { id: movie.id },
        data: {
          watched: true,
          watchedAt,
          // Set status to "watched" for legacy compat (pre-TVM-03 apps that
          // still read status). The TVM-03+ runtime reads `watched` directly.
          status: "watched",
        },
      });
      updated++;
      if (sampleUpdates.length < 5) {
        sampleUpdates.push({
          title: movie.title,
          tmdbId: movie.tmdbId,
          rating: movie.userRating,
        });
      }
    }

    return NextResponse.json({
      ok: true,
      updated,
      totalCandidates: candidates.length,
      sample: sampleUpdates,
      message: updated > 0
        ? `${updated} movies backfilled as watched (based on existing ratings). Ratings preserved.`
        : "No movies needed backfill — all rated movies are already marked watched.",
    });
  } catch (error: any) {
    console.error("[admin:backfill-watched-from-ratings]", error);
    return NextResponse.json({ error: error?.message || "Failed" }, { status: 500 });
  }
}
