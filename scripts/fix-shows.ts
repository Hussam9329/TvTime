/**
 * Disabled by TVM-03/04/05.
 * This legacy script used to mark shows watched and assign rating=75 in the
 * same write, which violates rating/watch independence and ignores future
 * episodes. Use the episode tracking UI; the shared TV state engine will
 * derive Watching / Up To Date / Finished safely.
 */
console.error("scripts/fix-shows.ts is intentionally disabled. No data was changed.");
process.exitCode = 1;
