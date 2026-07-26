import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireAdminCommand } from "@/lib/admin-guard";

const OPERATION = "reset-accidental-watched";

// Read-only by default. This legacy repair may use rating=75 only as a search
// signature, but it never changes the rating. TVM-03 forbids a watch-state
// repair from adding or removing a rating.
export async function POST(req: NextRequest) {
  const command = await requireAdminCommand(req, OPERATION);
  if (!command.ok) return command.response;

  try {
    const candidates = await db.media.findMany({
      where: {
        userId: command.userId,
        type: "movie",
        watched: true,
        userRating: 75,
        status: "watched",
      },
      select: { id: true, tmdbId: true, title: true, userRating: true, status: true, watchedAt: true },
    });

    let resetWatchState = 0;
    if (command.apply) {
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
      dryRun: !command.apply,
      resetWatchState,
      ratingChanges: 0,
      candidates,
      confirmation: command.apply ? undefined : command.confirmation,
    });
  } catch (error: any) {
    console.error("[admin:reset-accidental-watched]", error);
    return NextResponse.json({ error: error?.message || "Failed" }, { status: 500 });
  }
}
