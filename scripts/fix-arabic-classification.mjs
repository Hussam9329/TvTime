#!/usr/bin/env node
/**
 * Fix Arabic media classification and titles/posters.
 *
 * Two phases:
 * 1. Re-classify: any Media row currently isArabic=true but originalLanguage !== 'ar'
 *    is misclassified (foreign film shot in an Arab country). Set isArabic=false.
 * 2. Refresh Arabic titles/posters: for Media rows where originalLanguage === 'ar',
 *    fetch TMDB details with language=ar and update title, originalTitle, overview,
 *    and poster to the Arabic-localized versions when TMDB provides them.
 *
 * Idempotent: re-running produces the same end state.
 * Conservative: never clears a non-empty title/poster without a replacement.
 *
 * Usage:
 *   node scripts/fix-arabic-classification.mjs            # dry-run
 *   node scripts/fix-arabic-classification.mjs --apply     # apply changes
 */
const apply = process.argv.includes("--apply");
const apiKey = process.env.TMDB_API_KEY?.trim();

if (!apiKey) {
  console.error("[fix-arabic] TMDB_API_KEY is required.");
  process.exit(1);
}

const { PrismaClient } = await import("@prisma/client");
const prisma = new PrismaClient();

const TMDB_BASE = "https://api.themoviedb.org/3";
const TMDB_IMG = "https://image.tmdb.org/t/p";

function tmdbImage(path) {
  if (!path) return null;
  if (typeof path === "string" && path.startsWith("http")) return path;
  return `${TMDB_IMG}/w500${path}`;
}

async function fetchArabicDetails(item) {
  const endpoint = item.type === "series" ? "tv" : "movie";
  const url = new URL(`${TMDB_BASE}/${endpoint}/${item.tmdbId}`);
  url.searchParams.set("api_key", apiKey);
  url.searchParams.set("language", "ar");
  url.searchParams.set("include_image_language", "ar,null");
  const response = await fetch(url, { headers: { Accept: "application/json" } });
  if (!response.ok) throw new Error(`TMDB ${response.status} for ${endpoint}/${item.tmdbId}`);
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

try {
  // ===== Phase 1: re-classify misclassified rows =====
  const misclassified = await prisma.media.findMany({
    where: { isArabic: true, originalLanguage: { not: "ar" } },
    select: { id: true, title: true, type: true, tmdbId: true, originalLanguage: true, originCountries: true },
  });

  console.log(`\n=== Phase 1: re-classify ===`);
  console.log(`Found ${misclassified.length} misclassified rows (isArabic=true but originalLanguage !== 'ar')`);
  if (misclassified.length > 0) {
    console.log("Samples:");
    misclassified.slice(0, 10).forEach((m, i) => {
      console.log(`  ${i + 1}. ${m.title} (${m.type}, lang=${m.originalLanguage}, countries=${JSON.stringify(m.originCountries)})`);
    });
    if (apply) {
      const result = await prisma.media.updateMany({
        where: { isArabic: true, originalLanguage: { not: "ar" } },
        data: { isArabic: false },
      });
      console.log(`✓ Updated ${result.count} rows: isArabic=false`);
    } else {
      console.log(`[dry-run] Would set isArabic=false on ${misclassified.length} rows`);
    }
  }

  // ===== Phase 2: refresh Arabic titles/posters =====
  const trulyArabic = await prisma.media.findMany({
    where: { originalLanguage: "ar" },
    select: { id: true, title: true, originalTitle: true, overview: true, poster: true, type: true, tmdbId: true },
  });

  console.log(`\n=== Phase 2: refresh Arabic titles/posters ===`);
  console.log(`Found ${trulyArabic.length} Arabic-original rows (originalLanguage='ar')`);

  let updated = 0;
  let unchanged = 0;
  let failures = 0;
  const updates = [];

  await mapWithConcurrency(trulyArabic, 5, async (item) => {
    if (!item.tmdbId) { unchanged++; return; }
    try {
      const details = await fetchArabicDetails(item);
      const arabicTitle = (details.title || details.name || "").trim();
      const arabicOriginal = (details.original_title || details.original_name || "").trim();
      const arabicOverview = (details.overview || "").trim();
      const arabicPosterPath = details.poster_path;
      const arabicPoster = tmdbImage(arabicPosterPath);

      const patch = {};
      if (arabicTitle && arabicTitle !== item.title) patch.title = arabicTitle;
      if (arabicOriginal && arabicOriginal !== item.originalTitle) patch.originalTitle = arabicOriginal;
      // Only overwrite overview if TMDB has one and current is empty/different
      if (arabicOverview && arabicOverview !== item.overview) patch.overview = arabicOverview;
      // Only overwrite poster if TMDB has one and current is empty or different
      if (arabicPoster && arabicPoster !== item.poster) patch.poster = arabicPoster;

      if (Object.keys(patch).length === 0) {
        unchanged++;
        return;
      }
      updates.push({ id: item.id, patch, before: { title: item.title, poster: item.poster } });
    } catch (e) {
      failures++;
      console.error(`  [fail] ${item.title} (tmdbId=${item.tmdbId}): ${e.message}`);
    }
  });

  console.log(`\nArabic refresh summary:`);
  console.log(`  Rows needing update: ${updates.length}`);
  console.log(`  Unchanged: ${unchanged}`);
  console.log(`  Failures: ${failures}`);

  if (updates.length > 0) {
    console.log("\nSample updates:");
    updates.slice(0, 10).forEach((u, i) => {
      console.log(`  ${i + 1}. id=${u.id}`);
      if (u.patch.title) console.log(`     title: ${u.before.title} → ${u.patch.title}`);
      if (u.patch.poster) console.log(`     poster: ${u.before.poster || "(null)"} → ${u.patch.poster}`);
    });
  }

  if (apply && updates.length > 0) {
    await Promise.all(updates.map((u) => prisma.media.update({ where: { id: u.id }, data: u.patch })));
    console.log(`\n✓ Applied ${updates.length} updates`);
  } else if (updates.length > 0) {
    console.log(`\n[dry-run] Would apply ${updates.length} updates. Re-run with --apply.`);
  }

  // ===== Final summary =====
  const finalArabic = await prisma.media.count({ where: { isArabic: true } });
  const finalArabicLang = await prisma.media.count({ where: { isArabic: true, originalLanguage: "ar" } });
  console.log(`\n=== Final state ===`);
  console.log(`isArabic=true: ${finalArabic}`);
  console.log(`isArabic=true AND originalLanguage='ar': ${finalArabicLang}`);
  if (finalArabic !== finalArabicLang) {
    console.log(`⚠ Mismatch: ${finalArabic - finalArabicLang} rows still have isArabic=true without ar language`);
  } else {
    console.log(`✓ All isArabic=true rows have originalLanguage='ar'`);
  }
} catch (e) {
  console.error("[fix-arabic] ERROR:", e.message);
  process.exit(1);
} finally {
  await prisma.$disconnect();
}
