export type EpisodeMetadataSnapshot = {
  airedEpisodeKeys: ReadonlySet<string>;
  airedEpisodeInferenceReliable: boolean;
};

function normalizeArabicDigits(value: string): string {
  const arabicIndic = "٠١٢٣٤٥٦٧٨٩";
  const easternArabicIndic = "۰۱۲۳۴۵۶۷۸۹";
  return value.replace(/[٠-٩۰-۹]/g, (digit) => {
    const arabicIndex = arabicIndic.indexOf(digit);
    return String(arabicIndex >= 0 ? arabicIndex : easternArabicIndic.indexOf(digit));
  });
}

export function parseBacklogCount(type: string, body: string): number {
  if (type === "new_episode") return 1;
  const match = normalizeArabicDigits(String(body || "")).match(/(\d+)/);
  return match ? Math.max(0, Number(match[1]) || 0) : 0;
}

export function backlogBody(count: number): string {
  const safeCount = Math.max(0, Math.floor(Number(count) || 0));
  return safeCount === 1
    ? "لديك حلقة متاحة بانتظار المشاهدة."
    : `لديك ${safeCount} حلقات متاحة بانتظار المشاهدة.`;
}

export function canReconcileEpisodeBacklog(
  current: EpisodeMetadataSnapshot | null | undefined,
): current is EpisodeMetadataSnapshot {
  return current?.airedEpisodeInferenceReliable === true;
}

export function releasedEpisodeDelta(
  previous: EpisodeMetadataSnapshot | null | undefined,
  current: EpisodeMetadataSnapshot | null | undefined,
): number {
  if (!canReconcileEpisodeBacklog(previous) || !canReconcileEpisodeBacklog(current)) return 0;
  let count = 0;
  for (const key of current.airedEpisodeKeys) {
    if (!previous.airedEpisodeKeys.has(key)) count += 1;
  }
  return count;
}

export function shouldWakeBacklog(input: {
  hasExisting: boolean;
  previousMissingCount: number;
  missingCount: number;
  newlyReleasedCount: number;
}): boolean {
  if (!input.hasExisting) return true;
  return input.missingCount > input.previousMissingCount || input.newlyReleasedCount > 0;
}
