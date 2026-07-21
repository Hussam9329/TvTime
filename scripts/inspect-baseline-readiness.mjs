#!/usr/bin/env node
import { PrismaClient } from "@prisma/client";

const db = new PrismaClient();
const baseline = "20260710000000_baseline_core";

try {
  const result = await db.$transaction(async (tx) => {
    await tx.$executeRawUnsafe("SET TRANSACTION READ ONLY");
    const tables = await tx.$queryRawUnsafe(`
      SELECT table_name AS "name"
      FROM information_schema.tables
      WHERE table_schema = current_schema() AND table_type = 'BASE TABLE'
    `);
    const tableSet = new Set(tables.map((row) => String(row.name)));
    const hasMigrationTable = tableSet.has("_prisma_migrations");
    const applied = hasMigrationTable
      ? await tx.$queryRawUnsafe(`SELECT migration_name AS "name" FROM "_prisma_migrations" WHERE finished_at IS NOT NULL AND rolled_back_at IS NULL`)
      : [];
    return { tables: [...tableSet].sort(), applied: applied.map((row) => String(row.name)).sort() };
  });

  const core = ["User", "Media", "WatchlistItem", "WatchedMovie", "WatchedEpisode", "FollowingShow", "Rating"];
  const missingCore = core.filter((table) => !result.tables.includes(table));
  console.log(JSON.stringify({ baseline, missingCoreTables: missingCore, appliedMigrations: result.applied }, null, 2));
  if (missingCore.length > 0) {
    console.error("[baseline-readiness] Core tables are incomplete. Do not mark the baseline as applied.");
    process.exitCode = 1;
  } else if (result.applied.includes(baseline)) {
    console.log("[baseline-readiness] The baseline is already recorded.");
  } else {
    console.log(`[baseline-readiness] Inventory is compatible with baseline reconciliation on a clone.`);
    console.log(`After backup/restore testing, the operator command is: prisma migrate resolve --applied ${baseline}`);
  }
} catch (error) {
  console.error("[baseline-readiness] Read-only inventory failed.");
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
} finally {
  await db.$disconnect();
}
