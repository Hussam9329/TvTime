import { PrismaClient } from '@prisma/client';
import { writeFileSync } from 'fs';

const prisma = new PrismaClient();

async function main() {
  console.log('Starting backup...');
  
  const [media, users, watchedEpisodes, watchedMovies, watchlistItems, followingShows, ratings, tvMetadataCache] = await Promise.all([
    prisma.media.findMany(),
    prisma.user.findMany(),
    prisma.watchedEpisode.findMany(),
    prisma.watchedMovie.findMany(),
    prisma.watchlistItem.findMany(),
    prisma.followingShow.findMany(),
    prisma.rating.findMany(),
    prisma.tvMetadataCache.findMany(),
  ]);
  
  const backup = {
    timestamp: new Date().toISOString(),
    counts: {
      media: media.length,
      users: users.length,
      watchedEpisodes: watchedEpisodes.length,
      watchedMovies: watchedMovies.length,
      watchlistItems: watchlistItems.length,
      followingShows: followingShows.length,
      ratings: ratings.length,
      tvMetadataCache: tvMetadataCache.length,
    },
    data: {
      media, users, watchedEpisodes, watchedMovies, watchlistItems, followingShows, ratings, tvMetadataCache,
    }
  };
  
  const filename = `db-backups/backup-${Date.now()}.json`;
  writeFileSync(filename, JSON.stringify(backup, null, 2));
  console.log(`Backup saved to: ${filename}`);
  console.log('Counts:', backup.counts);
}
main().catch(console.error).finally(() => prisma.$disconnect());
