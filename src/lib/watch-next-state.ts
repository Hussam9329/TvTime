const LEGACY_FINISHED_TAG = "finished";

function normalizeWatchNextStatus(value: string | null | undefined): string | null {
  const normalized = String(value ?? "").trim().toLowerCase().replace(/[\s-]+/g, "_");
  if (!normalized) return null;
  if (["finished", "completed", "complete", "watched"].includes(normalized)) return "finished";
  if (["watching", "in_progress"].includes(normalized)) return "watching";
  return normalized;
}

export function hasExplicitLegacyFinishedTag(tags: string[] | null | undefined): boolean {
  return (tags ?? []).some(
    (tag) => String(tag).trim().toLowerCase() === LEGACY_FINISHED_TAG,
  );
}

export function clearExplicitLegacyFinishedTag(tags: string[] | null | undefined): string[] {
  return (tags ?? []).filter(
    (tag) => String(tag).trim().toLowerCase() !== LEGACY_FINISHED_TAG,
  );
}

/**
 * Historical imports used an explicit `finished` tag before every title had a
 * complete per-episode snapshot. Keep those ended + personally rated titles
 * out of Watch Next, while allowing a merely rated incomplete title back in.
 *
 * Episode mutations clear the legacy tag as soon as the title is no longer
 * Finished, so this compatibility rule cannot hide newly-unwatched episodes.
 */
export function shouldExcludeFromWatchNext(input: {
  status: string | null | undefined;
  watched: boolean;
  userRating: number | null | undefined;
  tags: string[] | null | undefined;
  officiallyEnded: boolean | null | undefined;
}): boolean {
  const status = normalizeWatchNextStatus(input.status);
  if (status === "finished") return true;
  if (input.watched && status !== "watching") return true;

  return input.officiallyEnded === true
    && input.userRating != null
    && hasExplicitLegacyFinishedTag(input.tags);
}
