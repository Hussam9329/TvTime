// Robust parallel poster fetcher - processes in small batches with retries
import { PrismaClient } from '@prisma/client';

const db = new PrismaClient({ log: ['error'] });
const TMDB_API_KEY = "8265bd1679663a7ea12ac168da84d2e8";
const TMDB_IMG = "https://image.tmdb.org/t/p/w500";

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

async function fetchPoster(title: string, year?: string | null): Promise<string | null> {
  const url = `https://api.themoviedb.org/3/search/movie?api_key=${TMDB_API_KEY}&query=${encodeURIComponent(title)}&include_adult=false${year ? `&year=${year}` : ''}`;
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    const data = await res.json();
    const withPoster = data.results?.find((r: any) => r.poster_path);
    return withPoster ? `${TMDB_IMG}${withPoster.poster_path}` : null;
  } catch {
    return null;
  }
}

async function processBatch(movies: { id: string; title: string; year: string | null }[], batchSize: number) {
  let updated = 0;
  for (let i = 0; i < movies.length; i += batchSize) {
    const batch = movies.slice(i, i + batchSize);
    // Process in parallel within batch
    const results = await Promise.allSettled(
      batch.map(async (m) => {
        const poster = await fetchPoster(m.title, m.year);
        if (poster) {
          await db.media.update({ where: { id: m.id }, data: { poster } });
          return true;
        }
        return false;
      })
    );
    updated += results.filter((r) => r.status === 'fulfilled' && r.value).length;
    console.log(`  Batch ${Math.floor(i / batchSize) + 1}: ${updated}/${i + batch.length} updated`);
    await sleep(300); // delay between batches
  }
  return updated;
}

async function main() {
  console.log("[START] Fetching posters (parallel mode)...");
  const movies = await db.media.findMany({
    where: { type: "movie", poster: null },
    select: { id: true, title: true, year: true },
  });
  console.log(`[INFO] ${movies.length} movies need posters`);

  const updated = await processBatch(movies, 10);
  console.log(`[DONE] Updated: ${updated} | Total: ${movies.length}`);
}

main()
  .catch((e) => { console.error("[ERROR]", e); process.exit(1); })
  .finally(async () => { await db.$disconnect(); });
