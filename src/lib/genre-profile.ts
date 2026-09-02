export type GenreProfileItem = {
  genres?: unknown[] | null;
};

export type GenreDistributionItem = {
  genre: string;
  count: number;
  percentage: number;
  titlePercentage: number;
};

function cleanGenre(value: unknown) {
  return String(value ?? "").trim();
}

export function mediaHasGenre(genres: unknown, selectedGenre: string | null | undefined) {
  const wanted = cleanGenre(selectedGenre).toLocaleLowerCase("en-US");
  if (!wanted) return true;
  if (!Array.isArray(genres)) return false;
  return genres.some((genre) => cleanGenre(genre).toLocaleLowerCase("en-US") === wanted);
}

export function buildGenreDistribution(items: GenreProfileItem[]) {
  const genreMap = new Map<string, number>();
  let totalGenreTags = 0;
  let titlesWithGenres = 0;

  for (const item of items) {
    const genres = [...new Set((Array.isArray(item.genres) ? item.genres : []).map(cleanGenre).filter(Boolean))];
    if (genres.length > 0) titlesWithGenres += 1;
    totalGenreTags += genres.length;
    for (const genre of genres) genreMap.set(genre, (genreMap.get(genre) || 0) + 1);
  }

  const distribution: GenreDistributionItem[] = [...genreMap.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .map(([genre, count]) => ({
      genre,
      count,
      percentage: totalGenreTags > 0 ? Math.round((count / totalGenreTags) * 1000) / 10 : 0,
      titlePercentage: titlesWithGenres > 0 ? Math.round((count / titlesWithGenres) * 1000) / 10 : 0,
    }));

  return {
    items: distribution,
    totalGenreTags,
    titlesWithGenres,
    titlesConsidered: items.length,
    coveragePercentage: items.length > 0 ? Math.round((titlesWithGenres / items.length) * 1000) / 10 : 100,
  };
}
