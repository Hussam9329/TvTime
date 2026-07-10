import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const TMDB_API_KEY = process.env.TMDB_API_KEY || "8265bd1679663a7ea12ac168da84d2e8";
const TMDB_BASE_URL = "https://api.themoviedb.org/3";

async function tmdbMovie(tmdbId) {
  const url = new URL(`${TMDB_BASE_URL}/movie/${tmdbId}`);
  url.searchParams.set("api_key", TMDB_API_KEY);
  url.searchParams.set("language", "en-US");
  const res = await fetch(url);
  if (!res.ok) throw new Error(`TMDB ${res.status} for movie ${tmdbId}`);
  return res.json();
}

async function safeUpdate(tableName, action) {
  try {
    return await action();
  } catch (error) {
    const message = String(error?.message || error);
    if (message.includes("does not exist") || message.includes("Unknown arg") || message.includes("Cannot read properties of undefined")) {
      console.log(`skip ${tableName}: table/model not available in this build`);
      return 0;
    }
    throw error;
  }
}

async function main() {
  let fixed = 0;
  const watchedMovies = await safeUpdate("watchedMovie", () => prisma.watchedMovie.findMany({
    select: { id: true, tmdbId: true, title: true, posterPath: true },
  })) || [];

  const mediaMovies = await safeUpdate("media", () => prisma.media.findMany({
    where: { type: "movie", tmdbId: { not: null } },
    select: { id: true, tmdbId: true, title: true, poster: true },
  })) || [];

  const tmdbIds = [...new Set([...watchedMovies, ...mediaMovies].map((item) => item.tmdbId).filter(Boolean))];
  const posterByTmdbId = new Map();

  for (const tmdbId of tmdbIds) {
    try {
      const movie = await tmdbMovie(tmdbId);
      posterByTmdbId.set(tmdbId, movie.poster_path || null);
    } catch (error) {
      console.warn(`could not fetch movie ${tmdbId}: ${error.message}`);
    }
  }

  for (const item of watchedMovies) {
    const posterPath = posterByTmdbId.get(item.tmdbId);
    if (posterPath && item.posterPath !== posterPath) {
      await prisma.watchedMovie.update({ where: { id: item.id }, data: { posterPath } });
      fixed++;
      console.log(`fixed watched movie poster: ${item.title} (${item.tmdbId})`);
    }
  }

  for (const item of mediaMovies) {
    const posterPath = posterByTmdbId.get(item.tmdbId);
    const poster = posterPath ? `https://image.tmdb.org/t/p/w500${posterPath}` : null;
    if (poster && item.poster !== poster) {
      await prisma.media.update({ where: { id: item.id }, data: { poster } });
      fixed++;
      console.log(`fixed media poster: ${item.title} (${item.tmdbId})`);
    }
  }

  console.log(`poster repair complete: ${fixed} row(s) updated`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
