/**
 * Shared colour ladder for personal scores out of 100.
 *
 * One source of truth for the high / good / average / low bands so every
 * rating surface (detail pages, rating dialogs) colours the same score the
 * same way.
 */
export type RatingTone = "high" | "good" | "average" | "low";

export function ratingTone(score: number): RatingTone {
  if (score >= 80) return "high";
  if (score >= 60) return "good";
  if (score >= 40) return "average";
  return "low";
}

const RATING_TONE_TEXT: Record<RatingTone, string> = {
  high: "text-emerald-600 dark:text-emerald-400",
  good: "text-amber-600 dark:text-amber-400",
  average: "text-orange-600 dark:text-orange-400",
  low: "text-destructive",
};

/** Tailwind text colour for a score out of 100; muted when there is no score. */
export function ratingToneClass(score: number | null | undefined): string {
  if (score == null || !Number.isFinite(score)) return "text-muted-foreground";
  return RATING_TONE_TEXT[ratingTone(score)];
}
