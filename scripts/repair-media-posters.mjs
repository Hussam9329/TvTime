import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const TMDB_API_KEY = process.env.TMDB_API_KEY || "8265bd1679663a7ea12ac168da84d2e8";
const TMDB_BASE_URL = "https://api.themoviedb.org/3";

async function tmdbDetails(type, tmdbId) {
  const endpoint = type === "series" ? "tv" : "movie";
  const url = new URL(`${TMDB_BASE_URL}/${endpoint}/${tmdbId}`);
  url.searchParams.set("api_key", TMDB_API_KEY);
  url.searchParams.set("language", "en-US");
  const response = await fetch(url);
  if (!response.ok) throw new Error(`TMDB ${response.status} for ${endpoint} ${tmdbId}`);
  return response.json();
}

async function main() {
  const media = await prisma.media.findMany({
    where: { type: { in: ["movie", "series"] }, tmdbId: { not: null } },
    select: { id: true, tmdbId: true, title: true, type: true, poster: true },
  });

  let fixed = 0;
  for (const item of media) {
    try {
      const details = await tmdbDetails(item.type, item.tmdbId);
      const poster = details.poster_path
        ? `https://image.tmdb.org/t/p/w500${details.poster_path}`
        : null;
      if (poster && poster !== item.poster) {
        await prisma.media.update({ where: { id: item.id }, data: { poster } });
        fixed += 1;
        console.log(`fixed media poster: ${item.title} (${item.tmdbId})`);
      }
    } catch (error) {
      console.warn(`could not repair ${item.title}: ${error.message}`);
    }
  }

  console.log(`poster repair complete: ${fixed} canonical Media row(s) updated`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
