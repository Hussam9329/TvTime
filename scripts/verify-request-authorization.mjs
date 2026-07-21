#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";

const failures = [];
const read = (file) => fs.readFileSync(file, "utf8");

function walk(dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name);
    return entry.isDirectory() ? walk(full) : [full];
  });
}

const routeFiles = walk("src/app/api").filter((file) => file.endsWith("/route.ts"));
const publicRouteSuffixes = new Set([
  "src/app/api/route.ts",
  "src/app/api/auth/login/route.ts",
  "src/app/api/auth/logout/route.ts",
  "src/app/api/auth/status/route.ts",
  "src/app/api/tmdb/[...path]/route.ts",
  "src/app/api/movies/calendar/route.ts",
  "src/app/api/tv/calendar/route.ts",
  "src/app/api/arabic-movies/calendar/route.ts",
]);

for (const file of routeFiles) {
  const normalized = file.split(path.sep).join("/");
  const source = read(file);

  if (/parseUserId/.test(source)) failures.push(`${normalized}: legacy parseUserId is forbidden`);
  if (/searchParams\.get\(["']userId|headers\.get\(["']x-user-id/.test(source)) {
    failures.push(`${normalized}: routes must not read userId directly from the request`);
  }

  if (!publicRouteSuffixes.has(normalized) && !/resolveUserId\(req\)/.test(source)) {
    failures.push(`${normalized}: user-owned route does not resolve ownership from the authenticated request`);
  }
}

const clientUser = read("src/lib/client-user.ts");
if (/searchParams\.set\(["']userId|["']x-user-id["']\s*:/.test(clientUser)) {
  failures.push("src/lib/client-user.ts: browser requests still send a forgeable user selector");
}

const authSource = read("src/lib/auth.ts");
if (!/sessionUserId:\s*session\?\.sub/.test(authSource)) {
  failures.push("src/lib/auth.ts: request ownership is not sourced from the verified session subject");
}

const adminGuard = read("src/lib/admin-guard.ts");
if (!/authorization/.test(adminGuard) || !/parseBearerSecret/.test(adminGuard)) {
  failures.push("src/lib/admin-guard.ts: admin secret must use an Authorization bearer header");
}
if (/searchParams|get\(["']x-admin-repair-secret|\?secret/.test(adminGuard)) {
  failures.push("src/lib/admin-guard.ts: URL/custom legacy secret transport is still accepted");
}
if (!/parseAdminCommandBody/.test(adminGuard)) {
  failures.push("src/lib/admin-guard.ts: dry-run/confirmation parser is not enforced");
}

const adminRoutes = routeFiles.filter((file) => file.includes(`${path.sep}admin${path.sep}`));
for (const file of adminRoutes) {
  const normalized = file.split(path.sep).join("/");
  const source = read(file);
  if (/export async function GET/.test(source)) failures.push(`${normalized}: mutating admin endpoint still exports GET`);
  if (!/export async function POST/.test(source)) failures.push(`${normalized}: admin endpoint must export POST`);
  if (!/requireAdminCommand\(req,\s*OPERATION\)/.test(source)) failures.push(`${normalized}: shared admin command guard missing`);
  if (!/resolveUserId\(req\)/.test(source)) failures.push(`${normalized}: admin operation is not scoped to the authenticated owner`);
  if (/req\.nextUrl\.searchParams/.test(source)) failures.push(`${normalized}: admin operation options must come from JSON, not URL parameters`);
}

const allSource = walk("src").filter((file) => /\.(ts|tsx)$/.test(file)).map(read).join("\n");
if (/x-admin-repair-secret|searchParams\.get\(["']secret/.test(allSource)) {
  failures.push("legacy admin secret transport remains in source");
}

if (failures.length > 0) {
  console.error("Request authorization verification failed:");
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log(`Request authorization verification passed: ${routeFiles.length} API routes, ${adminRoutes.length} admin routes.`);
