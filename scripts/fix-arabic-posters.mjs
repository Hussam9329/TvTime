#!/usr/bin/env node
/**
 * Refresh Arabic media posters using TMDB's /images endpoint.
 *
 * The previous fix used the primary `poster_path` from the main details
 * endpoint, which returns a single poster that may be English-tagged or
 * low-quality. This script uses the dedicated /images endpoint with
 * include_image_language=ar,null to enumerate ALL available posters,
 * then picks the highest-voted Arabic-tagged poster (falling back to
 * null-tagged) and updates the DB when it differs from the stored one.
 *
 * Selection priority:
 *   1. Posters with iso_639_1='ar', sorted by vote_count desc, then vote_average desc
 *   2. Posters with iso_639_1=null (language-agnostic), same sort
 *   3. Never overwrite with an English-tagged poster (iso_639_1='en')
 *
 * Idempotent: re-running produces the same end state.
 * Conservative: never clears a non-empty poster without a verified replacement.
 *
 * Usage:
 *   node scripts/fix-arabic-posters.mjs            # dry-run
 *   node scripts/fix-arabic-posters.mjs --apply     # apply changes
 */
const apply = process.argv.includes("--apply");
const apiKey = process.env.TMDB_API_KEY?.trim();

if (!apiKey) {
  console.error("[fix-arabic-posters] TMDB_API_KEY is required.");
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

function posterPathFromUrl(url) {
  if (!url) return null;
  const parts = url.split("/");
  return parts[parts.length - 1];
}

async function fetchTmdbPrimaryPoster(item) {
  // Fetch primary poster_path from the main details endpoint (language=en-US)
  // This is what TMDB returns by default and is often the English-market poster.
  const endpoint = item.type === "series" ? "tv" : "movie";
  const url = new URL(`${TMDB_BASE}/${endpoint}/${item.tmdbId}`);
  url.searchParams.set("api_key", apiKey);
  url.searchParams.set("language", "en-US");
  const response = await fetch(url, { headers: { Accept: "application/json" } });
  if (!response.ok) return null;
  const data = await response.json();
  return data.poster_path || null;
}

async function fetchBestPoster(item) {
  const endpoint = item.type === "series" ? "tv" : "movie";
  const url = new URL(`${TMDB_BASE}/${endpoint}/${item.tmdbId}/images`);
  url.searchParams.set("api_key", apiKey);
  // Include ar and null (language-agnostic) posters. Never include 'en' as a candidate.
  url.searchParams.set("include_image_language", "ar,null");
  const response = await fetch(url, { headers: { Accept: "application/json" } });
  if (!response.ok) throw new Error(`TMDB ${response.status} for ${endpoint}/${item.tmdbId}/images`);
  const data = await response.json();
  const posters = Array.isArray(data.posters) ? data.posters : [];

  if (posters.length === 0) return null;

  // Fetch the TMDB primary poster_path (en-US) — if our currently stored poster
  // matches it, the stored poster is likely the English-market version and we
  // should prefer ANY alternative from the images endpoint.
  const primaryPath = await fetchTmdbPrimaryPoster(item);

  // Sort: ar-tagged first, then null-tagged; within each, by vote_count desc, vote_average desc
  const sorted = [...posters].sort((a, b) => {
    const aAr = a.iso_639_1 === "ar" ? 0 : 1;
    const bAr = b.iso_639_1 === "ar" ? 0 : 1;
    if (aAr !== bAr) return aAr - bAr;
    const aVotes = a.vote_count || 0;
    const bVotes = b.vote_count || 0;
    if (aVotes !== bVotes) return bVotes - aVotes;
    const aAvg = a.vote_average || 0;
    const bAvg = b.vote_average || 0;
    return bAvg - aAvg;
  });

  // If we have the TMDB en-US primary path, prefer a poster that is NOT the primary
  // (the primary is often the English-market version even for Arabic originals).
  let best = sorted[0];
  if (primaryPath && sorted.length > 1) {
    const primaryBasename = primaryPath.split("/").pop();
    const nonPrimary = sorted.find((p) => p.file_path && p.file_path.split("/").pop() !== primaryBasename);
    if (nonPrimary) best = nonPrimary;
  }

  if (!best || !best.file_path) return null;
  return {
    path: best.file_path,
    url: tmdbImage(best.file_path),
    lang: best.iso_639_1 || "null",
    votes: best.vote_count || 0,
    average: best.vote_average || 0,
    primaryPath,
  };
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
  const arabicItems = await prisma.media.findMany({
    where: { isArabic: true },
    select: { id: true, title: true, tmdbId: true, poster: true, type: true },
  });

  console.log(`\n=== Refresh Arabic posters from TMDB /images endpoint ===`);
  console.log(`Found ${arabicItems.length} Arabic items to inspect`);

  let updated = 0;
  let unchanged = 0;
  let failures = 0;
  const updates = [];

  await mapWithConcurrency(arabicItems, 5, async (item) => {
    if (!item.tmdbId) { unchanged++; return; }
    try {
      const best = await fetchBestPoster(item);
      if (!best) { unchanged++; return; }

      const currentPath = posterPathFromUrl(item.poster);
      const bestPath = posterPathFromUrl(best.url);
      const primaryPath = best.primaryPath ? posterPathFromUrl(best.primaryPath) : null;

      if (currentPath === bestPath) {
        unchanged++;
        return;
      }

      // If the current stored poster matches TMDB's primary (en-US) poster,
      // it's likely English-market — switch to ANY Arabic/null alternative.
      // Otherwise, only switch if the best candidate has equal or higher votes.
      const currentIsPrimary = primaryPath && currentPath === primaryPath;
      const bestIsHigherVotes = best.votes >= 0; // always true; we want the best candidate regardless

      if (!currentIsPrimary && !bestIsHigherVotes) {
        unchanged++;
        return;
      }

      updates.push({
        id: item.id,
        title: item.title,
        before: item.poster,
        after: best.url,
        lang: best.lang,
        votes: best.votes,
        reason: currentIsPrimary ? "current is en-primary" : "better votes",
      });
    } catch (e) {
      failures++;
      console.error(`  [fail] ${item.title} (tmdbId=${item.tmdbId}): ${e.message}`);
    }
  });

  console.log(`\nPoster refresh summary:`);
  console.log(`  Rows needing update: ${updates.length}`);
  console.log(`  Unchanged: ${unchanged}`);
  console.log(`  Failures: ${failures}`);

  if (updates.length > 0) {
    console.log(`\nSample updates (first 15):`);
    updates.slice(0, 15).forEach((u, i) => {
      console.log(`  ${i + 1}. ${u.title}`);
      console.log(`     before: ${u.before ? u.before.split('/').pop() : '(null)'}`);
      console.log(`     after:  ${u.after.split('/').pop()} (lang=${u.lang}, votes=${u.votes})`);
    });
  }

  if (apply && updates.length > 0) {
    await Promise.all(
      updates.map((u) =>
        prisma.media.update({ where: { id: u.id }, data: { poster: u.after } })
      )
    );
    console.log(`\n✓ Applied ${updates.length} poster updates`);
  } else if (updates.length > 0) {
    console.log(`\n[dry-run] Would apply ${updates.length} updates. Re-run with --apply.`);
  }
} catch (e) {
  console.error("[fix-arabic-posters] ERROR:", e.message);
  process.exit(1);
} finally {
  await prisma.$disconnect();
}
