/**
 * Disabled by TVM-03/04/05.
 * This one-off legacy importer bypassed the shared TV state engine and could overwrite tracking states.
 * Use the application APIs, which validate released episodes and derive state centrally.
 */
console.error("scripts/add-following-shows.ts is intentionally disabled. No data was changed.");
process.exitCode = 1;
