/**
 * Disabled by TVM-03/04/05.
 * It compared watched rows with the TMDB lifetime episode total, included
 * future episodes, and generated a default rating. The app now recalculates
 * status from released episodes through src/lib/tv-status-engine.ts.
 */
console.error("scripts/fix-watched-shows.ts is intentionally disabled. No data was changed.");
process.exitCode = 1;
