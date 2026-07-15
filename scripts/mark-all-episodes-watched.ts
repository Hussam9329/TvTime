/**
 * Disabled by TVM-03/04/05.
 * This legacy localStorage exporter marked lifetime/future episodes as watched and bypassed PostgreSQL tracking.
 * Use the application APIs, which validate released episodes and derive state centrally.
 */
console.error("scripts/mark-all-episodes-watched.ts is intentionally disabled. No data was changed.");
process.exitCode = 1;
