import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { updateCanonicalMediaState } from "@/lib/media-repository";

// One-time repair for rows created by the old "rating implies watched" flow.
//
// Safety: this endpoint is dry-run by default. It only mutates data when
// `apply=true` is explicitly supplied. TVM-02 prevents this signature from
// recurring because a rating update no longer changes Media.libraryState.
export async function GET(req: NextRequest) {
  const expectedSecret = process.env.ADMIN_REPAIR_SECRET;
  if (expectedSecret) {
    const provided = req.nextUrl.searchParams.get("secret");
    if (provided !== expectedSecret) {
      return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    }
  }

  const apply = req.nextUrl.searchParams.get("apply") === "true";

  try {
    const candidates = await db.media.findMany({
      where: {
        type: "movie",
        libraryState: "completed",
        userRating: 75,
      },
      select: {
        id: true,
        tmdbId: true,
        title: true,
        type: true,
        watchedAt: true,
      },
    });

    if (apply) {
      for (const candidate of candidates) {
        await updateCanonicalMediaState(candidate, "planned", {
          // This endpoint targets accidental default ratings, so remove that
          // rating while preserving every other metadata field.
          data: { userRating: null },
        });
        console.log(`reset accidental watched: ${candidate.title} (tmdbId=${candidate.tmdbId})`);
      }
    }

    return NextResponse.json({
      ok: true,
      dryRun: !apply,
      reset: apply ? candidates.length : 0,
      matched: candidates.length,
      candidates: candidates.map(({ id, tmdbId, title, watchedAt }) => ({
        id,
        tmdbId,
        title,
        watchedAt,
      })),
    });
  } catch (error: any) {
    console.error("[admin:reset-accidental-watched]", error);
    return NextResponse.json({ error: error?.message || "Failed" }, { status: 500 });
  }
}
