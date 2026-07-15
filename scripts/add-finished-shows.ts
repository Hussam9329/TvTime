/**
 * Disabled by TVM-03/04/05.
 * The former script force-created Finished rows and default ratings without
 * verifying official TMDB end status or released episodes. That can corrupt
 * tracking state, so completion must now come only from watched episode rows
 * and the shared TV state engine.
 */
console.error("scripts/add-finished-shows.ts is intentionally disabled. No data was changed.");
process.exitCode = 1;
