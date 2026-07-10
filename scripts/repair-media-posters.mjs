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

async function main() {
  let fixed = 0;
  const mediaMovies = await prisma.media.findMany({
    where: { type: "movie", tmdbId: { not: null } },
    select: { id: true, tmdbId: true, title: true, poster: true },
  });

  for (const item of mediaMovies) {
    try {
      const movie = await tmdbMovie(item.tmdbId);
      const poster = movie.poster_path ? `https://image.tmdb.org/t/p/w500${movie.poster_path}` : null;
      if (poster && item.poster !== poster) {
        await prisma.media.update({ where: { id: item.id }, data: { poster } });
        fixed++;
        console.log(`fixed media poster: ${item.title} (${item.tmdbId})`);
      }
    } catch (error) {
      console.warn(`could not fetch movie ${item.tmdbId}: ${error.message}`);
    }
  }

  console.log(`poster repair complete: ${fixed} Media row(s) updated`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => prisma.$disconnect());
