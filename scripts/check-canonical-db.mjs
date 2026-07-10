import { PrismaClient } from "@prisma/client";

const db = new PrismaClient({ log: ["error"] });
const VALID = new Set(["none", "planned", "watching", "up_to_date", "completed"]);

function expected(item) {
  const completed = item.libraryState === "completed" || item.libraryState === "up_to_date";
  const status = item.libraryState === "none"
    ? null
    : item.libraryState === "up_to_date"
      ? "uptodate"
      : item.libraryState === "completed"
        ? item.type === "series" ? "finished" : "watched"
        : item.libraryState;
  return { completed, status };
}

async function main() {
  await db.$queryRaw`SELECT 1`;

  const requiredTables = ["User", "Media", "WatchedEpisode", "AppMeta"];
  const tableRows = await db.$queryRawUnsafe(`SELECT name FROM sqlite_master WHERE type='table'`);
  const tableNames = new Set(tableRows.map((row) => String(row.name)));
  const missingTables = requiredTables.filter((name) => !tableNames.has(name));

  const integrityRows = await db.$queryRawUnsafe(`PRAGMA integrity_check`);
  const integrityOk = integrityRows.length === 1 && String(Object.values(integrityRows[0])[0]).toLowerCase() === "ok";
  const foreignKeyFailures = await db.$queryRawUnsafe(`PRAGMA foreign_key_check`);
  const duplicateRows = await db.$queryRawUnsafe(`
    SELECT userId, type, tmdbId, COUNT(*) AS count
    FROM Media
    WHERE tmdbId IS NOT NULL
    GROUP BY userId, type, tmdbId
    HAVING COUNT(*) > 1
  `);

  const rows = await db.media.findMany({
    select: { id: true, title: true, type: true, libraryState: true, status: true, watched: true, watchedAt: true, userRating: true },
  });
  const failures = [];
  if (missingTables.length) failures.push(`missing required tables: ${missingTables.join(", ")}`);
  if (!integrityOk) failures.push("SQLite integrity_check did not return ok");
  if (foreignKeyFailures.length) failures.push(`foreign key violations: ${foreignKeyFailures.length}`);
  if (duplicateRows.length) failures.push(`duplicate canonical TMDB rows: ${duplicateRows.length}`);

  for (const item of rows) {
    if (!VALID.has(item.libraryState)) failures.push(`${item.id}: invalid state ${item.libraryState}`);
    const exp = expected(item);
    if (item.watched !== exp.completed) failures.push(`${item.id}: watched mirror mismatch`);
    if (item.status !== exp.status) failures.push(`${item.id}: status mirror mismatch (${item.status} != ${exp.status})`);
    if (exp.completed && !item.watchedAt) failures.push(`${item.id}: completed without watchedAt`);
    if (!exp.completed && item.watchedAt) failures.push(`${item.id}: non-completed with watchedAt`);
  }

  if (failures.length) {
    console.error("[TVM] canonical DB verification failed:\n" + failures.slice(0, 50).map((x) => ` - ${x}`).join("\n"));
    process.exitCode = 1;
    return;
  }

  const counts = rows.reduce((acc, row) => {
    acc[row.libraryState] = (acc[row.libraryState] || 0) + 1;
    return acc;
  }, {});
  console.log(`[TVM] canonical DB verified: media=${rows.length}, states=${JSON.stringify(counts)}`);
}

main()
  .catch((error) => {
    console.error("[TVM] canonical DB verification failed", error);
    process.exitCode = 1;
  })
  .finally(() => db.$disconnect());
