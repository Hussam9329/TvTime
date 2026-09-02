import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const APPLY = process.argv.includes("--apply");
const VERIFY_ONLY = process.argv.includes("--verify-only");
const delayMs = Math.max(100, Number(process.env.FILM_SERIES_DELAY_MS || 300));
const apiKey = String(process.env.TMDB_API_KEY || "").trim();

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
async function tmdb(path: string) {
  const response = await fetch(`https://api.themoviedb.org/3${path}?api_key=${encodeURIComponent(apiKey)}`);
  if (!response.ok) throw new Error(`TMDB_${response.status}`);
  return response.json() as Promise<any>;
}

async function main() {
  const missing = await prisma.media.count({ where: { type: "movie", tmdbId: { not: null }, seriesId: null } });
  console.log(`[film-series] ${missing} movie rows are not linked to a collection (standalone films are expected here).`);
  if (VERIFY_ONLY) {
    const [seriesCount, linkedMovies, brokenLinks] = await Promise.all([
      prisma.filmSeries.count(),
      prisma.media.count({ where: { type: "movie", seriesId: { not: null } } }),
      prisma.$queryRaw<Array<{ count: number }>>`SELECT COUNT(*)::integer AS count FROM "Media" media JOIN "FilmSeries" series ON series.id = media."seriesId" WHERE media."userId" <> series."userId"`,
    ]);
    const broken = Number(brokenLinks[0]?.count || 0);
    console.log(`[film-series] series=${seriesCount} linkedMovies=${linkedMovies} crossUserBrokenLinks=${broken}`);
    if (broken > 0) process.exitCode = 2;
    return;
  }
  if (!apiKey) throw new Error("TMDB_API_KEY is required");
  const rows = await prisma.media.findMany({
    where: { type: "movie", tmdbId: { not: null }, seriesId: null },
    select: { id: true, userId: true, tmdbId: true, title: true },
    orderBy: { addedAt: "asc" },
  });
  let linked = 0;
  let standalone = 0;
  let failed = 0;
  for (const row of rows) {
    try {
      const movie = await tmdb(`/movie/${row.tmdbId}`);
      const ref = movie.belongs_to_collection;
      if (!ref?.id) { standalone++; await sleep(delayMs); continue; }
      const collection = await tmdb(`/collection/${ref.id}`);
      const parts = [...(Array.isArray(collection.parts) ? collection.parts : [])].sort((a, b) => String(a.release_date || "9999").localeCompare(String(b.release_date || "9999")) || Number(a.id) - Number(b.id));
      const partIndex = parts.findIndex((part) => Number(part.id) === row.tmdbId!);
      const seriesPart = partIndex >= 0 ? partIndex + 1 : null;
      console.log(`[film-series] ${row.title} -> ${collection.name} #${seriesPart ?? "?"}`);
      if (APPLY) {
        const series = await prisma.filmSeries.upsert({
          where: { userId_tmdbCollectionId: { userId: row.userId, tmdbCollectionId: Number(collection.id) } },
          create: { userId: row.userId, tmdbCollectionId: Number(collection.id), name: String(collection.name || ref.name), posterPath: collection.poster_path || ref.poster_path || null, totalParts: parts.length },
          update: { name: String(collection.name || ref.name), posterPath: collection.poster_path || ref.poster_path || null, totalParts: parts.length },
        });
        await prisma.media.update({ where: { id: row.id }, data: { seriesId: series.id, seriesPart } });
      }
      linked++;
    } catch (error) {
      failed++;
      console.error(`[film-series] failed ${row.title}:`, error instanceof Error ? error.message : error);
    }
    await sleep(delayMs);
  }
  console.log(`[film-series] mode=${APPLY ? "APPLY" : "DRY_RUN"} linked=${linked} standalone=${standalone} failed=${failed}`);
  if (failed > 0) process.exitCode = 2;
}

main().finally(() => prisma.$disconnect());
