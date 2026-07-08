// Fetch posters from TMDB - robust version with delays and error handling
import { PrismaClient } from '@prisma/client';

const db = new PrismaClient({ log: ['error'] });
const TMDB_API_KEY = "8265bd1679663a7ea12ac168da84d2e8";
const TMDB_BASE = "https://api.themoviedb.org/3";
const TMDB_IMG = "https://image.tmdb.org/t/p/w500";

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

async function searchMovie(title: string, year?: string | null): Promise<string | null> {
  const url = new URL(`${TMDB_BASE}/search/movie`);
  url.searchParams.set("api_key", TMDB_API_KEY);
  url.searchParams.set("query", title);
  url.searchParams.set("include_adult", "false");
  if (year) url.searchParams.set("year", year);

  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const res = await fetch(url);
      if (res.status === 429) {
        await sleep(2000);
        continue;
      }
      if (!res.ok) return null;
      const data = await res.json();
      if (data.results && data.results.length > 0) {
        const withPoster = data.results.find((r: any) => r.poster_path);
        if (withPoster) return `${TMDB_IMG}${withPoster.poster_path}`;
      }
      return null;
    } catch {
      await sleep(1000);
    }
  }
  return null;
}

async function main() {
  console.log("[START] Fetching posters...");
  const movies = await db.media.findMany({
    where: { type: "movie", poster: null },
    select: { id: true, title: true, year: true },
  });
  console.log(`[INFO] ${movies.length} movies need posters`);

  let updated = 0;
  let failed = 0;

  for (let i = 0; i < movies.length; i++) {
    const movie = movies[i];
    const poster = await searchMovie(movie.title, movie.year);

    if (poster) {
      try {
        await db.media.update({ where: { id: movie.id }, data: { poster } });
        updated++;
      } catch (e) {
        failed++;
      }
    } else {
      failed++;
    }

    if ((i + 1) % 50 === 0) {
      console.log(`[PROGRESS] ${i + 1}/${movies.length} | Updated: ${updated} | Failed: ${failed}`);
    }

    // Small delay between requests to avoid rate limiting
    await sleep(250);
  }

  console.log(`[DONE] Updated: ${updated} | Failed: ${failed} | Total: ${movies.length}`);
}

main()
  .catch((e) => { console.error("[ERROR]", e); process.exit(1); })
  .finally(async () => { await db.$disconnect(); });
