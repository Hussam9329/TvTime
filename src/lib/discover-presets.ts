export type DiscoverPresetId = "trending" | "top2024" | "hidden" | "newest" | "classic";

export interface DiscoverPresetState {
  sortBy: string;
  fromYear: string;
  toYear: string;
  minVotes: string;
}

interface DiscoverPresetOptions {
  isTv: boolean;
  isArabic: boolean;
  currentYear: number;
}

export function applyDiscoverPreset(
  current: DiscoverPresetState,
  presetId: DiscoverPresetId,
  options: DiscoverPresetOptions,
): DiscoverPresetState {
  const next = { ...current };
  const hasYearRange = current.fromYear !== "" || current.toYear !== "";

  switch (presetId) {
    case "trending":
      next.sortBy = "popularity.desc";
      break;
    case "top2024":
      next.sortBy = "vote_average.desc";
      if (!hasYearRange) {
        next.fromYear = "2024";
        next.toYear = "2024";
      }
      break;
    case "hidden":
      next.sortBy = "vote_average.desc";
      if (!next.minVotes) next.minVotes = options.isArabic ? "20" : "100";
      break;
    case "newest":
      next.sortBy = options.isTv ? "first_air_date.desc" : "primary_release_date.desc";
      break;
    case "classic":
      next.sortBy = "popularity.desc";
      if (!hasYearRange) next.toYear = String(options.currentYear - 30);
      break;
  }

  return next;
}
