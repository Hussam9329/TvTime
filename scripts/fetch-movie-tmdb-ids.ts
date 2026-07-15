import { PrismaClient } from '@prisma/client';
const db = new PrismaClient({ log: ['error'] });
const TMDB_API_KEY = process.env.TMDB_API_KEY?.trim();
if (!TMDB_API_KEY) {
  console.error("TMDB_API_KEY env var is required. Refusing to start.");
  process.exit(1);
}
function sleep(ms: number) { return new Promise((r) => setTimeout(r, ms)); }
async function searchMovie(title: string, year?: string | null): Promise<number | null> {
  const url = `https://api.themoviedb.org/3/search/movie?api_key=${TMDB_API_KEY}&query=${encodeURIComponent(title)}&include_adult=true${year ? `&year=${year}` : ''}`;
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    const data = await res.json();
    if (data.results?.length > 0) return data.results[0].id;
    if (year) {
      const url2 = `https://api.themoviedb.org/3/search/movie?api_key=${TMDB_API_KEY}&query=${encodeURIComponent(title)}&include_adult=true`;
      const res2 = await fetch(url2);
      if (!res2.ok) return null;
      const data2 = await res2.json();
      if (data2.results?.length > 0) return data2.results[0].id;
    }
    return null;
  } catch { return null; }
}
async function main() {
  console.log("[START] Fetching tmdbId for movies...");
  const movies = await db.media.findMany({ where: { type: "movie", tmdbId: null }, select: { id: true, title: true, year: true } });
  console.log(`[INFO] ${movies.length} movies need tmdbId`);
  let updated = 0, failed = 0;
  for (let i = 0; i < movies.length; i += 10) {
    const batch = movies.slice(i, i + 10);
    const results = await Promise.allSettled(batch.map(async (m) => {
      const tmdbId = await searchMovie(m.title, m.year);
      if (tmdbId) { await db.media.update({ where: { id: m.id }, data: { tmdbId } }); return true; }
      return false;
    }));
    updated += results.filter(r => r.status === 'fulfilled' && r.value).length;
    failed += results.filter(r => r.status !== 'fulfilled' || !r.value).length;
    if ((i + 10) % 100 === 0 || i + 10 >= movies.length) console.log(`  Progress: ${i + batch.length}/${movies.length} | Updated: ${updated} | Failed: ${failed}`);
    await sleep(300);
  }
  console.log(`[DONE] Updated: ${updated} | Failed: ${failed}`);
}
main().catch(e => { console.error("[ERROR]", e); process.exit(1); }).finally(async () => { await db.$disconnect(); });
