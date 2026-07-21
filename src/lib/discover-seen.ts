export const TV_STARTED_STATUSES = new Set(["watching", "uptodate", "up_to_date", "finished", "watched"]);

export type SeenMediaRow = {
  tmdbId: number | null;
  watched?: boolean | null;
  status?: string | null;
};

/**
 * A movie is seen after a movie watch. A TV title is seen/started after at
 * least one watched episode or a persisted progress/completion state.
 */
export function buildSeenIdSet(
  mediaType: "movie" | "tv",
  mediaRows: readonly SeenMediaRow[],
  legacyIds: readonly number[],
): Set<number> {
  const result = new Set<number>();
  for (const id of legacyIds) {
    if (Number.isInteger(id) && id > 0) result.add(id);
  }
  for (const row of mediaRows) {
    const id = Number(row.tmdbId);
    if (!Number.isInteger(id) || id <= 0) continue;
    if (mediaType === "movie") {
      if (row.watched) result.add(id);
      continue;
    }
    const status = String(row.status || "").trim().toLowerCase();
    if (row.watched || TV_STARTED_STATUSES.has(status)) result.add(id);
  }
  return result;
}
