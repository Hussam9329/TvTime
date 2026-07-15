#!/usr/bin/env node
const apply = process.argv.includes("--apply");
const userArg = process.argv.find((arg) => arg.startsWith("--user="));
const limitArg = process.argv.find((arg) => arg.startsWith("--limit="));
const userId = userArg ? userArg.slice("--user=".length).trim() : null;
const limit = limitArg ? Math.max(1, Number(limitArg.slice("--limit=".length)) || 0) : undefined;
const apiKey = process.env.TMDB_API_KEY?.trim();

const ARAB_COUNTRY_CODES = new Set([
  "DZ", "BH", "KM", "DJ", "EG", "IQ", "JO", "KW", "LB", "LY", "MR",
  "MA", "OM", "PS", "QA", "SA", "SO", "SD", "SY", "TN", "AE", "YE",
]);

function uniqueCountryCodes(value) {
  return [...new Set((Array.isArray(value) ? value : [])
    .map((country) => String(country || "").trim().toUpperCase())
    .filter(Boolean))];
}

function isArabic(originalLanguage, originCountries) {
  // Arabic originals require original_language === "ar". Origin country alone
  // is intentionally NOT enough: many foreign productions are shot or
  // co-produced in Arab countries without being Arabic-language originals.
  return String(originalLanguage || "").toLowerCase() === "ar";
}

async function fetchDetails(item) {
  const path = item.type === "series" ? "tv" : "movie";
  const url = new URL(`https://api.themoviedb.org/3/${path}/${item.tmdbId}`);
  url.searchParams.set("api_key", apiKey);
  url.searchParams.set("language", "en-US");
  const response = await fetch(url, { headers: { Accept: "application/json" } });
  if (!response.ok) throw new Error(`TMDB ${response.status}`);
  return response.json();
}

async function mapWithConcurrency(items, concurrency, worker) {
  let cursor = 0;
  const runners = Array.from({ length: Math.min(concurrency, items.length) }, async () => {
    while (cursor < items.length) {
      const index = cursor++;
      await worker(items[index], index);
    }
  });
  await Promise.all(runners);
}

if (!apiKey) {
  console.error("[arabic-backfill] TMDB_API_KEY is required. No database writes were attempted.");
  process.exit(1);
}

const { PrismaClient } = await import("@prisma/client");
const prisma = new PrismaClient();

try {
  const items = await prisma.media.findMany({
    where: {
      tmdbId: { not: null },
      type: { in: ["movie", "series"] },
      ...(userId ? { userId } : {}),
    },
    select: {
      id: true,
      userId: true,
      tmdbId: true,
      type: true,
      title: true,
      isArabic: true,
      isAnime: true,
      originalLanguage: true,
      originCountries: true,
    },
    orderBy: { addedAt: "asc" },
    ...(limit ? { take: limit } : {}),
  });

  let scanned = 0;
  let classifiedArabic = 0;
  let metadataUpdates = 0;
  let unchanged = 0;
  const failures = [];

  console.log(`[arabic-backfill] ${apply ? "APPLY" : "DRY RUN"}: inspecting ${items.length} Media rows.`);

  await mapWithConcurrency(items, 4, async (item) => {
    try {
      const details = await fetchDetails(item);
      const originalLanguage = typeof details.original_language === "string"
        ? details.original_language.trim().toLowerCase() || null
        : null;
      const originCountries = uniqueCountryCodes(
        item.type === "series"
          ? details.origin_country
          : details.production_countries?.map((country) => country?.iso_3166_1),
      );
      const detectedArabic = isArabic(originalLanguage, originCountries);
      const metadataChanged = item.originalLanguage !== originalLanguage
        || JSON.stringify(item.originCountries) !== JSON.stringify(originCountries);
      const classificationChanged = detectedArabic && !item.isArabic;

      scanned++;
      if (detectedArabic) classifiedArabic++;
      if (metadataChanged || classificationChanged) metadataUpdates++;
      else unchanged++;

      if (apply && (metadataChanged || classificationChanged)) {
        await prisma.media.update({
          where: { id: item.id },
          data: {
            originalLanguage,
            originCountries,
            ...(detectedArabic ? { isArabic: true, isAnime: false } : {}),
          },
        });
      }
    } catch (error) {
      failures.push({
        id: item.id,
        tmdbId: item.tmdbId,
        title: item.title,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  });

  console.log(JSON.stringify({
    mode: apply ? "apply" : "dry-run",
    scanned,
    classifiedArabic,
    rowsNeedingUpdate: metadataUpdates,
    unchanged,
    failures: failures.length,
  }, null, 2));

  if (!apply && metadataUpdates > 0) {
    console.log("[arabic-backfill] Dry run only. Re-run with --apply after reviewing the counts and taking a verified backup.");
  }
  if (failures.length > 0) {
    console.error("[arabic-backfill] Some TMDB lookups failed. No failed row was modified.");
    console.error(failures.slice(0, 20));
    process.exitCode = 1;
  }
} catch (error) {
  console.error("[arabic-backfill] Failed before completion. No reset or destructive command was used.");
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
} finally {
  await prisma.$disconnect();
}
