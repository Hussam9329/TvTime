import { db } from "@/lib/db";

type CompletionRatingRepair = {
  movies: number;
  series: number;
};

const repairedUsers = new Map<string, Promise<CompletionRatingRepair>>();

/**
 * Repair historical completion rows created before personal ratings became
 * mandatory. Episode progress and TV watchedAt timestamps are retained; only
 * the invalid title-level completion marker is removed.
 *
 * Every current mutation path also enforces this invariant. This repair is for
 * pre-existing rows and is intentionally idempotent.
 */
export function ensureCompletionRatingInvariant(userId: string): Promise<CompletionRatingRepair> {
  const existing = repairedUsers.get(userId);
  if (existing) return existing;

  const repair = db.$transaction(async (tx) => {
    const movieStatus = await tx.media.updateMany({
      where: {
        userId,
        type: "movie",
        status: "watched",
        userRating: null,
      },
      data: {
        status: null,
        watched: false,
        watchedAt: null,
      },
    });
    const movieFlag = await tx.media.updateMany({
      where: {
        userId,
        type: "movie",
        watched: true,
        userRating: null,
      },
      data: {
        watched: false,
        watchedAt: null,
      },
    });

    const seriesStatus = await tx.media.updateMany({
      where: {
        userId,
        type: "series",
        status: { in: ["finished", "completed", "watched"] },
        userRating: null,
      },
      data: {
        status: "uptodate",
        watched: false,
      },
    });
    const seriesFlag = await tx.media.updateMany({
      where: {
        userId,
        type: "series",
        watched: true,
        userRating: null,
      },
      data: {
        watched: false,
      },
    });

    return {
      movies: movieStatus.count + movieFlag.count,
      series: seriesStatus.count + seriesFlag.count,
    };
  });

  repairedUsers.set(userId, repair);
  repair.catch(() => repairedUsers.delete(userId));
  return repair;
}
