// Fetch tmdbId for series that don't have it
import { PrismaClient } from '@prisma/client';

const db = new PrismaClient({ log: ['error'] });
const TMDB_API_KEY = process.env.TMDB_API_KEY?.trim();
if (!TMDB_API_KEY) {
  console.error("TMDB_API_KEY env var is required. Refusing to start.");
  process.exit(1);
}

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

async function searchTvShow(title: string, year?: string | null): Promise<number | null> {
  const url = `https://api.themoviedb.org/3/search/tv?api_key=${TMDB_API_KEY}&query=${encodeURIComponent(title)}&include_adult=true${year ? `&first_air_date_year=${year}` : ''}`;
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    const data = await res.json();
    if (data.results && data.results.length > 0) {
      return data.results[0].id;
    }
    // Try without year
    if (year) {
      const url2 = `https://api.themoviedb.org/3/search/tv?api_key=${TMDB_API_KEY}&query=${encodeURIComponent(title)}&include_adult=true`;
      const res2 = await fetch(url2);
      if (!res2.ok) return null;
      const data2 = await res2.json();
      if (data2.results && data2.results.length > 0) {
        return data2.results[0].id;
      }
    }
    return null;
  } catch {
    return null;
  }
}

async function main() {
  console.log("[START] Fetching tmdbId for series...");
  const series = await db.media.findMany({
    where: { type: "series", tmdbId: null },
    select: { id: true, title: true, year: true },
  });
  console.log(`[INFO] ${series.length} series need tmdbId`);

  let updated = 0;
  let failed = 0;
  const batchSize = 10;

  for (let i = 0; i < series.length; i += batchSize) {
    const batch = series.slice(i, i + batchSize);
    const results = await Promise.allSettled(
      batch.map(async (s) => {
        const tmdbId = await searchTvShow(s.title, s.year);
        if (tmdbId) {
          await db.media.update({ where: { id: s.id }, data: { tmdbId } });
          return true;
        }
        return false;
      })
    );
    updated += results.filter((r) => r.status === 'fulfilled' && r.value).length;
    failed += results.filter((r) => r.status !== 'fulfilled' || !r.value).length;
    console.log(`  Batch ${Math.floor(i / batchSize) + 1}: ${updated}/${i + batch.length} updated`);
    await sleep(300);
  }

  console.log(`[DONE] Updated: ${updated} | Failed: ${failed} | Total: ${series.length}`);
}

main()
  .catch((e) => { console.error("[ERROR]", e); process.exit(1); })
  .finally(async () => { await db.$disconnect(); });
