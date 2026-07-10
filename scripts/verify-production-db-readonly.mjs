import { PrismaClient } from '@prisma/client';

const db = new PrismaClient({ log: ['error'] });

async function main() {
  const [users, media, watchlist, watchedMovies, watchedEpisodes, following, ratings] = await Promise.all([
    db.user.count(),
    db.media.count(),
    db.watchlistItem.count(),
    db.watchedMovie.count(),
    db.watchedEpisode.count(),
    db.followingShow.count(),
    db.rating.count(),
  ]);

  console.log(JSON.stringify({
    users,
    media,
    watchlist,
    watchedMovies,
    watchedEpisodes,
    following,
    ratings,
    totalLibraryRows: media + watchlist + watchedMovies + watchedEpisodes + following + ratings,
  }, null, 2));
}

main()
  .catch((error) => {
    console.error('[RECOVERY] Read-only database verification failed:', error?.message || error);
    process.exitCode = 1;
  })
  .finally(() => db.$disconnect());
