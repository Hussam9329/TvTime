import { PrismaClient } from '@prisma/client';
const db = new PrismaClient({ log: ['error'] });

async function main() {
  console.log("[START] Fixing shows that are fully watched but still in watchlist...");
  
  // Get all series that are NOT watched (still in watchlist)
  const series = await db.media.findMany({
    where: { type: "series", watched: false },
    select: { id: true, tmdbId: true, title: true, episodes: true, status: true },
  });
  console.log(`[INFO] Checking ${series.length} unwatched series...`);

  let fixed = 0;
  for (const show of series) {
    if (!show.tmdbId || !show.episodes) continue;
    
    // Count watched episodes for this show
    const watchedCount = await db.watchedEpisode.count({
      where: { showId: show.tmdbId },
    });

    if (watchedCount >= show.episodes && show.episodes > 0) {
      // Show is fully watched! Move to Finished
      await db.media.update({
        where: { id: show.id },
        data: {
          watched: true,
          status: "watched",
          watchedAt: new Date(),
          userRating: 75,
        },
      });
      console.log(`  Fixed: ${show.title} (${watchedCount}/${show.episodes} episodes)`);
      fixed++;
    }
  }

  console.log(`\n[DONE] Fixed ${fixed} shows that were fully watched but still in watchlist`);
}

main().catch(e => { console.error("[ERROR]", e); process.exit(1); }).finally(async () => { await db.$disconnect(); });
