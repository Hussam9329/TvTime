/**
 * Disabled by TVM-06/07/08/09.
 *
 * This legacy script wrote Media.status, Media.watched and Media.userRating
 * directly from an old JSON file. That could restore an ongoing show as
 * Finished or import a whole-series rating before the official ending.
 *
 * Use the Library import UI/API instead. It restores episode progress first,
 * rebuilds TV state through the central engine and applies whole-series ratings
 * only after the Ended/Canceled + all-final-episodes-watched rule passes.
 */
console.error("scripts/import-backup.ts is intentionally disabled. No data was changed.");
process.exitCode = 1;
