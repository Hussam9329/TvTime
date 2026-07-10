import { PrismaClient } from "@prisma/client";

const db = new PrismaClient();

async function main() {
  const [users, media, watchedEpisodes, episodeRatings, legacyWatchlist, legacyWatchedMovies, legacyFollowing, legacyTitleRatings] = await Promise.all([
    db.user.count(),
    db.media.count(),
    db.watchedEpisode.count(),
    db.rating.count({ where: { mediaType: { startsWith: "episode:" } } }),
    db.watchlistItem.count(),
    db.watchedMovie.count(),
    db.followingShow.count(),
    db.rating.count({ where: { mediaType: { in: ["movie", "tv", "series"] } } }),
  ]);

  console.log(JSON.stringify({
    users,
    canonical: { media, watchedEpisodes, episodeRatings },
    legacyResidue: {
      watchlistItems: legacyWatchlist,
      watchedMovies: legacyWatchedMovies,
      followingShows: legacyFollowing,
      titleRatings: legacyTitleRatings,
      total: legacyWatchlist + legacyWatchedMovies + legacyFollowing + legacyTitleRatings,
    },
    sourceOfTruth: "Media",
    note: "WatchedEpisode and episode:* Rating rows are canonical supporting tables, not duplicate title libraries.",
  }, null, 2));
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => db.$disconnect());
