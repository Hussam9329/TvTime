import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireAdminCommand } from "@/lib/admin-guard";

const OPERATION = "backfill-watched-from-ratings";

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

export async function POST(req: NextRequest) {
  const command = await requireAdminCommand(req, OPERATION);
  if (!command.ok) return command.response;

  try {
    // Find all movies that have a rating but are NOT marked watched.
    // These are the "disappeared" movies — the user rated them (meaning they
    // watched them) but the watched flag was never set.
    const candidates = await db.media.findMany({
      where: {
        userId: command.userId,
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
      if (command.apply) {
        await db.media.update({
          where: { id: movie.id },
          data: {
            watched: true,
            watchedAt,
            status: "watched",
          },
        });
      }
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
      dryRun: !command.apply,
      updated,
      totalCandidates: candidates.length,
      sample: sampleUpdates,
      message: updated > 0
        ? command.apply
          ? `${updated} movies backfilled as watched (based on existing ratings). Ratings preserved.`
          : `DRY RUN: ${updated} movies qualify. Re-submit with apply=true and confirm=${command.confirmation}.`
        : "No movies needed backfill — all rated movies are already marked watched.",
    });
  } catch (error: any) {
    console.error("[admin:backfill-watched-from-ratings]", error);
    return NextResponse.json({ error: error?.message || "Failed" }, { status: 500 });
  }
}
