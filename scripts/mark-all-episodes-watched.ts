// Mark all episodes of finished shows as watched in localStorage
// This script generates a JSON that the browser can import into localStorage
import { PrismaClient } from '@prisma/client';

const db = new PrismaClient({ log: ['error'] });
const TMDB_API_KEY = "8265bd1679663a7ea12ac168da84d2e8";

function sleep(ms: number) { return new Promise((r) => setTimeout(r, ms)); }

async function getSeasonEpisodes(tmdbId: number, seasonNumber: number): Promise<any[]> {
  const url = `https://api.themoviedb.org/3/tv/${tmdbId}/season/${seasonNumber}?api_key=${TMDB_API_KEY}`;
  try {
    const res = await fetch(url);
    if (!res.ok) return [];
    const data = await res.json();
    return data.episodes || [];
  } catch {
    return [];
  }
}

async function main() {
  console.log("[START] Getting all finished series from DB...");
  const series = await db.media.findMany({
    where: { type: "series", watched: true, status: "watched", tmdbId: { not: null } },
    select: { id: true, tmdbId: true, title: true, seasons: true },
  });
  console.log(`[INFO] Found ${series.length} finished series`);

  // Build the watched episodes array for localStorage
  const allWatchedEpisodes: any[] = [];
  let showsProcessed = 0;

  for (const show of series) {
    if (!show.tmdbId) continue;
    const tmdbId = show.tmdbId;
    
    // Fetch seasons 1-10 (covers most shows)
    const maxSeasons = Math.min(show.seasons || 5, 10);
    for (let s = 1; s <= maxSeasons; s++) {
      const episodes = await getSeasonEpisodes(tmdbId, s);
      for (const ep of episodes) {
        if (ep.episode_number > 0) {
          allWatchedEpisodes.push({
            id: `auto_${tmdbId}_${s}_${ep.episode_number}_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
            showId: tmdbId,
            seasonNumber: s,
            episodeNumber: ep.episode_number,
            episodeName: ep.name || null,
            watchedAt: new Date().toISOString(),
          });
        }
      }
    }
    
    showsProcessed++;
    if (showsProcessed % 20 === 0) {
      console.log(`  Progress: ${showsProcessed}/${series.length} shows | ${allWatchedEpisodes.length} episodes marked`);
    }
    await sleep(100); // small delay
  }

  console.log(`\n[DONE] Processed ${showsProcessed} shows | ${allWatchedEpisodes.length} total episodes marked as watched`);
  
  // Write the JSON file that the frontend can use
  const fs = await import('fs');
  fs.writeFileSync('/home/z/my-project/scripts/all-watched-episodes.json', JSON.stringify(allWatchedEpisodes));
  console.log(`[SAVED] episodes saved to scripts/all-watched-episodes.json`);
}

main()
  .catch((e) => { console.error("[ERROR]", e); process.exit(1); })
  .finally(async () => { await db.$disconnect(); });
