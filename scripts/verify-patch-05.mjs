#!/usr/bin/env node
import assert from "node:assert/strict";
import fs from "node:fs";
import { spawnSync } from "node:child_process";

const pkg = JSON.parse(fs.readFileSync("package.json", "utf8"));
const postgresUrl = (...parts) => parts.join("");
const run = (script, env = {}) => spawnSync(process.execPath, [script], {
  cwd: process.cwd(),
  encoding: "utf8",
  env: { ...process.env, DATABASE_URL: "", TVTIME_AUDIT_DATABASE_URL: "", ...env },
});

const history = run("scripts/verify-migration-history.mjs");
assert.equal(history.status, 0, history.stderr || history.stdout);

assert.notEqual(run("scripts/assert-production-db.mjs").status, 0, "missing DATABASE_URL must fail");
assert.notEqual(
  run("scripts/assert-production-db.mjs", { DATABASE_URL: "file:./dev.db" }).status,
  0,
  "non-PostgreSQL DATABASE_URL must fail",
);
assert.equal(
  run("scripts/assert-production-db.mjs", { DATABASE_URL: postgresUrl("postgresql", "://app:strong-secret@db.internal/tvtime") }).status,
  0,
  "valid PostgreSQL target should pass the URL-only guard",
);
assert.notEqual(
  run("scripts/assert-production-db.mjs", {
    DATABASE_URL: postgresUrl("postgresql", "://audit:strong-secret@db.internal/tvtime"),
    TVTIME_AUDIT_DATABASE_URL: postgresUrl("postgresql", "://audit:strong-secret@db.internal/tvtime"),
  }).status,
  0,
  "audit and app credentials must be independent",
);

for (const name of ["db:push", "db:sync", "db:reset", "db:migrate"]) {
  assert.match(pkg.scripts[name], /refuse-destructive-db-command\.mjs/);
}
assert.match(pkg.scripts.build, /verify-migration-history\.mjs/);
assert.match(pkg.scripts.build, /verify-required-schema\.mjs/);
assert.match(pkg.scripts["db:migrate:deploy"], /prisma migrate deploy/);

console.log("[patch-05] Static migration, target and deployment-guard tests passed.");
