// Backfill episode facts for canonically completed series.
import { PrismaClient } from "@prisma/client";

const db = new PrismaClient({ log: ["error"] });
const TMDB_API_KEY = process.env.TMDB_API_KEY || "8265bd1679663a7ea12ac168da84d2e8";

function sleep(ms: number) { return new Promise((resolve) => setTimeout(resolve, ms)); }

async function getSeasonEpisodes(tmdbId: number, seasonNumber: number): Promise<any[]> {
  const url = `https://api.themoviedb.org/3/tv/${tmdbId}/season/${seasonNumber}?api_key=${TMDB_API_KEY}`;
  try {
    const response = await fetch(url);
    if (!response.ok) return [];
    const data = await response.json();
    return data.episodes || [];
  } catch {
    return [];
  }
}

async function main() {
  const series = await db.media.findMany({
    where: { type: "series", libraryState: "completed", tmdbId: { not: null } },
    select: { userId: true, tmdbId: true, title: true, seasons: true },
  });
  console.log(`[INFO] Found ${series.length} completed series`);

  let episodesUpserted = 0;
  for (let index = 0; index < series.length; index += 1) {
    const show = series[index];
    if (!show.tmdbId) continue;
    const maxSeasons = Math.min(show.seasons || 5, 30);
    for (let seasonNumber = 1; seasonNumber <= maxSeasons; seasonNumber += 1) {
      const episodes = await getSeasonEpisodes(show.tmdbId, seasonNumber);
      for (const episode of episodes) {
        if (episode.episode_number <= 0) continue;
        await db.watchedEpisode.upsert({
          where: {
            userId_showId_seasonNumber_episodeNumber: {
              userId: show.userId,
              showId: show.tmdbId,
              seasonNumber,
              episodeNumber: episode.episode_number,
            },
          },
          create: {
            userId: show.userId,
            showId: show.tmdbId,
            seasonNumber,
            episodeNumber: episode.episode_number,
            episodeName: episode.name || null,
            runtime: episode.runtime || null,
          },
          update: {
            episodeName: episode.name || null,
            runtime: episode.runtime || null,
          },
        });
        episodesUpserted += 1;
      }
    }
    if ((index + 1) % 20 === 0 || index + 1 === series.length) {
      console.log(`  Progress: ${index + 1}/${series.length} | Episodes: ${episodesUpserted}`);
    }
    await sleep(100);
  }

  console.log(`[DONE] ${episodesUpserted} episode fact(s) stored in SQLite; localStorage is not used.`);
}

main().catch((error) => {
  console.error("[ERROR]", error);
  process.exit(1);
}).finally(async () => db.$disconnect());
