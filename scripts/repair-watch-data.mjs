// TvTime — data repair script (targeted, idempotent).
// 1) Backfill WatchSession.duration from WatchedEpisode.runtime (rewatch sessions
//    created by /api/library/rewatch/set before the duration fix).
// 2) Repair contradictory movies: watched=true with NULL/empty status -> 'watched'.
//
// Usage:
//   node scripts/repair-watch-data.mjs --dry-run   (default: no writes)
//   node scripts/repair-watch-data.mjs --apply     (writes)
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
const pg = require("pg");

const APPLY = process.argv.includes("--apply");
// SECURITY: this repo is public — never hardcode connection strings here.
// Provide the target database via env: NEON_DATABASE_URL="postgresql://..." node scripts/repair-watch-data.mjs
const CONN = process.env.NEON_DATABASE_URL;
if (!CONN) {
  console.error("Refusing to run: set NEON_DATABASE_URL env var to the target Postgres connection string.");
  process.exit(1);
}

const client = new pg.Client({ connectionString: CONN, ssl: { rejectUnauthorized: false } });

async function main() {
  await client.connect();
  console.log(`mode=${APPLY ? "APPLY" : "DRY-RUN"}`);

  // ---- 1) Backfill rewatch session durations -------------------------------
  const match = await client.query(`
    SELECT COUNT(*)::int AS matched
    FROM "WatchSession" s
    JOIN "WatchedEpisode" e
      ON e."userId" = s."userId"
     AND e."showId" = s."tmdbId"
     AND e."seasonNumber" = s.season
     AND e."episodeNumber" = s.episode
    WHERE s.duration IS NULL
      AND s.rewatch = true
      AND s.season IS NOT NULL
      AND s.episode IS NOT NULL
      AND e.runtime IS NOT NULL
  `);
  const stillNull = await client.query(`
    SELECT COUNT(*)::int AS n FROM "WatchSession" WHERE duration IS NULL AND rewatch = true
  `);
  console.log(`rewatch sessions with NULL duration: ${stillNull.rows[0].n}`);
  console.log(`  -> backfillable from WatchedEpisode.runtime: ${match.rows[0].matched}`);
  console.log(`  -> will keep the 45-min stats fallback: ${stillNull.rows[0].n - match.rows[0].matched}`);

  if (APPLY && match.rows[0].matched > 0) {
    const upd = await client.query(`
      UPDATE "WatchSession" s
      SET duration = e.runtime
      FROM "WatchedEpisode" e
      WHERE e."userId" = s."userId"
        AND e."showId" = s."tmdbId"
        AND e."seasonNumber" = s.season
        AND e."episodeNumber" = s.episode
        AND s.duration IS NULL
        AND s.rewatch = true
        AND e.runtime IS NOT NULL
    `);
    console.log(`UPDATE WatchSession.duration <- runtime: ${upd.rowCount} rows`);
  }

  // ---- 2) Repair watched movies with NULL/empty status ---------------------
  const bad = await client.query(`
    SELECT id, title, status, watched FROM "Media"
    WHERE type = 'movie' AND watched = true AND (status IS NULL OR status = '')
  `);
  console.log(`watched movies with NULL/empty status: ${bad.rows.length}`);
  for (const row of bad.rows) console.log(`  - ${row.id} ${row.title} (status=${JSON.stringify(row.status)})`);

  if (APPLY && bad.rows.length > 0) {
    const upd = await client.query(`
      UPDATE "Media"
      SET status = 'watched', "updatedAt" = NOW()
      WHERE type = 'movie' AND watched = true AND (status IS NULL OR status = '')
    `);
    console.log(`UPDATE Media.status='watched': ${upd.rowCount} rows`);
  }

  // ---- verification ---------------------------------------------------------
  if (APPLY) {
    const v1 = await client.query(`SELECT COUNT(*)::int AS n FROM "WatchSession" WHERE duration IS NULL AND rewatch = true`);
    const v2 = await client.query(`SELECT COUNT(*)::int AS n FROM "Media" WHERE type='movie' AND watched=true AND (status IS NULL OR status='')`);
    console.log(`verify: rewatch sessions still NULL duration = ${v1.rows[0].n}; bad-status movies = ${v2.rows[0].n}`);
  }
  await client.end();
}

main().catch(async (error) => {
  console.error(error);
  await client.end().catch(() => {});
  process.exit(1);
});
