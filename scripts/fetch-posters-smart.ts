// Smart poster fetcher - tries multiple search strategies for hard-to-find movies
import { PrismaClient } from '@prisma/client';

const db = new PrismaClient({ log: ['error'] });
const TMDB_API_KEY = process.env.TMDB_API_KEY?.trim();
if (!TMDB_API_KEY) {
  console.error("TMDB_API_KEY env var is required. Refusing to start.");
  process.exit(1);
}
const TMDB_IMG = "https://image.tmdb.org/t/p/w500";

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

async function searchTMDB(query: string, year?: string | null): Promise<string | null> {
  const url = `https://api.themoviedb.org/3/search/movie?api_key=${TMDB_API_KEY}&query=${encodeURIComponent(query)}&include_adult=true${year ? `&year=${year}` : ''}`;
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

async function fetchPosterSmart(title: string, year?: string | null): Promise<string | null> {
  // Strategy 1: Exact title + year
  let poster = await searchTMDB(title, year);
  if (poster) return poster;

  // Strategy 2: Exact title without year
  poster = await searchTMDB(title, null);
  if (poster) return poster;

  // Strategy 3: Try removing common suffixes (III, II, 2, 3, etc.)
  const cleaned = title
    .replace(/\s+(III|II|IV|Part\s+\d+|P\d+)/i, '')
    .replace(/\s+2$|\s+3$|\s+4$/i, '')
    .replace(/'/g, '');
  if (cleaned !== title) {
    poster = await searchTMDB(cleaned, year);
    if (poster) return poster;
    poster = await searchTMDB(cleaned, null);
    if (poster) return poster;
  }

  // Strategy 4: First 3 words only
  const words = title.split(' ').slice(0, 3).join(' ');
  if (words !== title && words.length > 2) {
    poster = await searchTMDB(words, year);
    if (poster) return poster;
  }

  return null;
}

async function main() {
  console.log("[START] Smart poster fetch...");
  const movies = await db.media.findMany({
    where: { type: "movie", poster: null },
    select: { id: true, title: true, year: true },
  });
  console.log(`[INFO] ${movies.length} movies need posters`);

  let updated = 0;
  let failed = 0;
  const batchSize = 10;

  for (let i = 0; i < movies.length; i += batchSize) {
    const batch = movies.slice(i, i + batchSize);
    const results = await Promise.allSettled(
      batch.map(async (m) => {
        const poster = await fetchPosterSmart(m.title, m.year);
        if (poster) {
          await db.media.update({ where: { id: m.id }, data: { poster } });
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

  console.log(`[DONE] Updated: ${updated} | Failed: ${failed} | Total: ${movies.length}`);
}

main()
  .catch((e) => { console.error("[ERROR]", e); process.exit(1); })
  .finally(async () => { await db.$disconnect(); });
