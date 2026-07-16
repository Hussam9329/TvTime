/**
 * TVM Fix #13: Anime detection from TMDB metadata.
 *
 * Determines if a TV show or movie is anime based on:
 * 1. Origin country (JP = Japan)
 * 2. Original language (ja = Japanese)
 * 3. Genres containing "Animation" or "Anime"
 * 4. Known anime title list (fallback for edge cases)
 *
 * Used by find-or-create to auto-set isAnime before saving.
 */

const KNOWN_ANIME_TITLES = [
  "attack on titan", "death note", "code geass", "tokyo ghoul", "charlotte",
  "one piece", "naruto", "bleach", "dragon ball", "demon slayer",
  "jujutsu kaisen", "my hero academia", "hunter x hunter", "fullmetal",
  "cowboy bebop", "one punch man", "mob psycho", "vinland saga", "chainsaw man",
  "spy x family", "sailor moon", "jujutsu", "sword art online",
  "re:zero", "konosuba", "overlord", "no game no life", "tokyo revengers",
  "jujutsu kaisen", "demon slayer", "black clover", "fairy tail",
  "one-punch man", "mob psycho 100", "bocchi the rock", "chainsaw",
];

export function isKnownAnimeTitle(title: string): boolean {
  const lower = title.toLowerCase();
  return KNOWN_ANIME_TITLES.some((k) => lower.includes(k));
}

/**
 * Detect if a media item is anime based on TMDB metadata.
 *
 * @param params - TMDB metadata fields
 * @returns true if the item should be classified as anime
 */
export function detectIsAnime(params: {
  originCountry?: string[] | null;
  originalLanguage?: string | null;
  genres?: string[] | { name: string }[] | null;
  title?: string;
}): boolean {
  // 1. Known anime title (manual override list)
  if (params.title && isKnownAnimeTitle(params.title)) {
    return true;
  }

  // 2. Origin country = Japan
  const originCountry = params.originCountry;
  if (Array.isArray(originCountry) && originCountry.includes("JP")) {
    // Japanese origin + animation genre = anime
    const genreNames = normalizeGenres(params.genres);
    if (genreNames.some((g) => g.includes("animation") || g.includes("anime"))) {
      return true;
    }
  }

  // 3. Original language = Japanese + animation genre
  if (params.originalLanguage === "ja") {
    const genreNames = normalizeGenres(params.genres);
    if (genreNames.some((g) => g.includes("animation") || g.includes("anime"))) {
      return true;
    }
  }

  // 4. Explicit "anime" genre (some TMDB entries have it)
  const genreNames = normalizeGenres(params.genres);
  if (genreNames.some((g) => g === "anime")) {
    return true;
  }

  return false;
}

function normalizeGenres(genres: string[] | { name: string }[] | null | undefined): string[] {
  if (!genres) return [];
  if (Array.isArray(genres)) {
    return genres.map((g) => {
      if (typeof g === "string") return g.toLowerCase();
      if (g && typeof g.name === "string") return g.name.toLowerCase();
      return "";
    });
  }
  return [];
}
