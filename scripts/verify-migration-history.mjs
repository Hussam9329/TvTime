#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const migrationsRoot = path.join(root, "prisma", "migrations");
const schemaPath = path.join(root, "prisma", "schema.prisma");
const packagePath = path.join(root, "package.json");

function fail(message) {
  console.error(`[migration-history] ${message}`);
  process.exitCode = 1;
}

function stripSqlComments(sql) {
  return sql
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/--.*$/gm, "");
}

if (!fs.existsSync(migrationsRoot) || !fs.existsSync(schemaPath)) {
  fail("prisma/schema.prisma or prisma/migrations is missing.");
  process.exit();
}

const migrationNames = fs.readdirSync(migrationsRoot, { withFileTypes: true })
  .filter((entry) => entry.isDirectory())
  .map((entry) => entry.name)
  .sort();

if (migrationNames[0] !== "20260710000000_baseline_core") {
  fail("The first migration must be 20260710000000_baseline_core.");
}

const migrations = migrationNames.map((name) => {
  const file = path.join(migrationsRoot, name, "migration.sql");
  if (!fs.existsSync(file)) {
    fail(`Migration ${name} is missing migration.sql.`);
    return { name, sql: "" };
  }
  return { name, sql: fs.readFileSync(file, "utf8") };
});

const schema = fs.readFileSync(schemaPath, "utf8");
const modelNames = [...schema.matchAll(/^model\s+(\w+)\s*\{/gm)].map((match) => match[1]);
const allSql = migrations.map((migration) => migration.sql).join("\n");

for (const model of modelNames) {
  const createTable = new RegExp(`CREATE\\s+TABLE(?:\\s+IF\\s+NOT\\s+EXISTS)?\\s+"${model}"`, "i");
  if (!createTable.test(allSql)) {
    fail(`No migration creates Prisma model ${model}.`);
  }
}

const baseline = migrations.find((migration) => migration.name === "20260710000000_baseline_core")?.sql || "";
for (const table of ["User", "Media", "WatchlistItem", "WatchedMovie", "WatchedEpisode", "FollowingShow", "Rating"]) {
  if (!new RegExp(`CREATE\\s+TABLE\\s+"${table}"`, "i").test(baseline)) {
    fail(`The baseline does not create ${table}.`);
  }
}

const featureMigration = migrations.find((migration) => migration.name === "20260715000000_feature_tables_and_rls")?.sql || "";
for (const table of ["WatchSession", "Notification", "CustomList", "CustomListItem"]) {
  if (!new RegExp(`CREATE\\s+TABLE\\s+IF\\s+NOT\\s+EXISTS\\s+"${table}"`, "i").test(featureMigration)) {
    fail(`The additive feature migration does not create or reconcile ${table}.`);
  }
}

for (const migration of migrations) {
  const executableSql = stripSqlComments(migration.sql);
  if (/\bDROP\s+TABLE\b|\bDROP\s+COLUMN\b|\bTRUNCATE\b/i.test(executableSql)) {
    fail(`Migration ${migration.name} contains an unreviewed destructive table operation.`);
  }
}

const pkg = JSON.parse(fs.readFileSync(packagePath, "utf8"));
const scripts = pkg.scripts || {};
for (const name of ["db:push", "db:sync", "db:reset", "db:migrate"]) {
  if (!String(scripts[name] || "").includes("refuse-destructive-db-command.mjs")) {
    fail(`${name} must remain blocked by refuse-destructive-db-command.mjs.`);
  }
}
if (!String(scripts.build || "").includes("verify-required-schema.mjs")) {
  fail("The production build does not run the live schema contract guard.");
}
if (!String(scripts.build || "").includes("verify-migration-history.mjs")) {
  fail("The production build does not run the static migration history guard.");
}
if (!String(scripts["db:migrate:deploy"] || "").includes("prisma migrate deploy")) {
  fail("db:migrate:deploy no longer invokes Prisma migrate deploy.");
}

if (process.exitCode) process.exit(process.exitCode);
console.log(`[migration-history] ${migrationNames.length} ordered migrations cover all ${modelNames.length} Prisma models.`);
