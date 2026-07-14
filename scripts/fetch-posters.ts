// Fetch posters from TMDB for movies that don't have them
import { db } from '../src/lib/db';

const TMDB_API_KEY = process.env.TMDB_API_KEY?.trim();
const TMDB_BASE = "https://api.themoviedb.org/3";
const TMDB_IMG = "https://image.tmdb.org/t/p/w500";

async function searchMovie(title: string, year?: string | null): Promise<string | null> {
  const url = new URL(`${TMDB_BASE}/search/movie`);
  url.searchParams.set("api_key", TMDB_API_KEY);
  url.searchParams.set("query", title);
  url.searchParams.set("include_adult", "false");
  if (year) url.searchParams.set("year", year);

  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    const data = await res.json();
    if (data.results && data.results.length > 0) {
      // Pick the first result with a poster
      const withPoster = data.results.find((r: any) => r.poster_path);
      if (withPoster) return `${TMDB_IMG}${withPoster.poster_path}`;
    }
    return null;
  } catch {
    return null;
  }
}

async function main() {
  console.log("Fetching movies without posters...");
  const movies = await db.media.findMany({
    where: { type: "movie", poster: null },
    select: { id: true, title: true, year: true },
  });
  console.log(`Found ${movies.length} movies without posters`);

  let updated = 0;
  let failed = 0;
  let batch = 0;
  const batchSize = 50;

  for (let i = 0; i < movies.length; i++) {
    const movie = movies[i];
    const poster = await searchMovie(movie.title, movie.year);

    if (poster) {
      await db.media.update({
        where: { id: movie.id },
        data: { poster },
      });
      updated++;
    } else {
      failed++;
    }

    batch++;
    if (batch >= batchSize) {
      console.log(`  Progress: ${i + 1}/${movies.length} | Updated: ${updated} | Failed: ${failed}`);
      batch = 0;
      // Small delay to respect rate limits
      await new Promise((r) => setTimeout(r, 500));
    }
  }

  console.log(`\nDone! Updated: ${updated} | Failed: ${failed} | Total: ${movies.length}`);
}

main()
  .catch((e) => {
    console.error("Script failed:", e);
    process.exit(1);
  })
  .finally(async () => {
    await db.$disconnect();
  });
