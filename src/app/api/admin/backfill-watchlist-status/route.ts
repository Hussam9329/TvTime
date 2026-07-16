import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { enforceAdminSecret } from "@/lib/admin-guard";

// One-time data backfill: aligns HISTORICAL watchlist data with the
// `status=planned` convention that the current app uses.
//
// Before TVM-03, the app derived watchlist membership from "no rating" rather
// than from `status=planned`. Many movies/series that the user added to their
// watchlist were created via find-or-create WITHOUT status being set, leaving
// `status=NULL`. After TVM-03, the watchlist tabs filter by `status=planned`,
// so those items disappeared.
//
// This endpoint sets status=planned for any media item where:
//   - watched = false (not watched)
//   - status is NULL or empty
//   - type is "movie" or "series"
//
// It is:
//   - Idempotent (safe to run multiple times)
//   - Does NOT touch watched items (they belong in Watched, not Watchlist)
//   - Does NOT touch ratings
//   - Does NOT touch the schema (no migration/db push)
//   - Respects existing progressive TV states (watching/uptodate/finished)
//     — only NULL/empty status is backfilled
//
// TVM-40: Always enforces ADMIN_REPAIR_SECRET.

export async function GET(req: NextRequest) {
  const guard = enforceAdminSecret(req);
  if (guard) return guard;

  try {
    // Find all unwatched media with NULL/empty status. These are the
    // "disappeared" watchlist items.
    const candidates = await db.media.findMany({
      where: {
        watched: false,
        OR: [
          { status: null },
          { status: "" },
        ],
        type: { in: ["movie", "series"] },
      },
      select: {
        id: true,
        title: true,
        type: true,
        tmdbId: true,
        status: true,
        userRating: true,
      },
    });

    let updated = 0;
    const sample: { title: string; type: string; tmdbId: number | null }[] = [];

    for (const item of candidates) {
      await db.media.update({
        where: { id: item.id },
        data: { status: "planned" },
      });
      updated++;
      if (sample.length < 5) {
        sample.push({
          title: item.title,
          type: item.type,
          tmdbId: item.tmdbId,
        });
      }
    }

    return NextResponse.json({
      ok: true,
      updated,
      totalCandidates: candidates.length,
      sample,
      message: updated > 0
        ? `${updated} items backfilled with status=planned (were NULL/empty, unwatched). Now visible in Watchlist tabs.`
        : "No items needed backfill — all unwatched items already have a status.",
    });
  } catch (error: any) {
    console.error("[admin:backfill-watchlist-status]", error);
    return NextResponse.json({ error: error?.message || "Failed" }, { status: 500 });
  }
}
