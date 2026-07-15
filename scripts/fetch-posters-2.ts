// Fetch posters from TMDB for movies that don't have them (batch 2)
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
      const withPoster = data.results.find((r: any) => r.poster_path);
      if (withPoster) return `${TMDB_IMG}${withPoster.poster_path}`;
    }
    return null;
  } catch {
    return null;
  }
}

async function main() {
  console.log("[START] Fetching movies without posters (batch 2)...");
  const movies = await db.media.findMany({
    where: { type: "movie", poster: null },
    select: { id: true, title: true, year: true },
  });
  console.log(`[INFO] Found ${movies.length} movies without posters`);

  let updated = 0;
  let failed = 0;

  for (let i = 0; i < movies.length; i++) {
    const movie = movies[i];
    try {
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

      // Log progress every 100 items
      if ((i + 1) % 100 === 0) {
        console.log(`[PROGRESS] ${i + 1}/${movies.length} | Updated: ${updated} | Failed: ${failed}`);
      }
    } catch (e) {
      failed++;
    }
  }

  console.log(`[DONE] Updated: ${updated} | Failed: ${failed} | Total processed: ${movies.length}`);
}

main()
  .catch((e) => {
    console.error("[ERROR] Script failed:", e);
    process.exit(1);
  })
  .finally(async () => {
    await db.$disconnect();
  });
