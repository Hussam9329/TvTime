#!/usr/bin/env node
import fs from "node:fs";

const read = (path) => fs.readFileSync(path, "utf8");
const checks = [];
const check = (name, condition) => checks.push({ name, ok: Boolean(condition) });

const schema = read("prisma/schema.prisma");
const migration = read("prisma/migrations/20260902090000_film_series/migration.sql");
const transfer = read("src/lib/library-transfer-types.ts");
const exportRoute = read("src/app/api/library/export/route.ts");
const importValidation = read("src/lib/library-import-validation.ts");
const importCommit = read("src/lib/library-import-commit.ts");
const mediaCreate = read("src/app/api/media/find-or-create/route.ts");
const nav = read("src/lib/navigation.ts");
const header = read("src/components/layout/header.tsx");
const appShell = read("src/components/app-shell.tsx");
const calendarApi = read("src/app/api/calendar/tracked/route.ts");
const sw = read("public/sw.js");
const middleware = read("src/middleware.ts");
const profile = read("src/components/profile/profile-dialog.tsx");
const providers = read("src/components/providers.tsx");
const manifest = JSON.parse(read("public/manifest.webmanifest"));

check("BAT-11 backup version is v7", transfer.includes("LIBRARY_BACKUP_VERSION = 7"));
check("BAT-11 keeps v5/v6 restore compatibility", transfer.includes("[5, 6, 7]"));
check("Backup embeds Film Series without internal seriesId", exportRoute.includes("filmSeries: series ?") && exportRoute.includes("seriesId: _seriesId"));
check("Import validates embedded Film Series", importValidation.includes("embeddedFilmSeriesSchema") && importValidation.includes("seriesPart"));
check("Atomic import recreates FilmSeries before Media", importCommit.indexOf('INSERT INTO "FilmSeries"') < importCommit.indexOf('INSERT INTO "Media"'));
check("Profile reports FilmSeries restore rows", profile.includes("filmSeriesRowsAffected"));
check("FilmSeries schema is additive", schema.includes("model FilmSeries") && schema.includes("seriesId       String?"));
check("FilmSeries migration contains no DROP/TRUNCATE", !/\bDROP\s+(TABLE|COLUMN)\b|\bTRUNCATE\b/i.test(migration));
check("FilmSeries migration enables RLS", migration.includes('ENABLE ROW LEVEL SECURITY') && migration.includes('film_series_isolate_own_rows'));
check("New movies auto-sync collection metadata", mediaCreate.includes("syncFilmSeriesForMedia"));
check("One-time FilmSeries backfill exists", fs.existsSync("prisma/scripts/backfill-film-series.ts"));
check("Collections view is routable", nav.includes('"collections"') && appShell.includes("<FilmSeriesView />") && header.includes('view: "collections"'));
check("Calendar view is routable", nav.includes('"calendar"') && appShell.includes("<CalendarView />") && header.includes('view: "calendar"'));
check("Calendar uses followed-show next episode cache", calendarApi.includes('isFollowing: true') && calendarApi.includes("nextEpisodeAirDate"));
check("Calendar labels season premieres", calendarApi.includes('episode === 1 ? "Season Premiere" : "New Episode"'));
check("PWA has offline fallback", fs.existsSync("public/offline.html") && sw.includes('caches.match("/offline.html")'));
check("PWA does not cache authenticated HTML", sw.includes('event.request.mode === "navigate"') && !sw.includes('cache.put(event.request, copy); }\n    return response;'));
check("Offline assets bypass auth middleware", middleware.includes('"/offline.html"') && middleware.includes('"/icon-192.png"'));
check("Install prompt captured globally", providers.includes("beforeinstallprompt") && profile.includes("Install app"));
check("Dark/Light/System theme controls exist", profile.includes('["dark", "light", "system"]') && providers.includes("enableSystem"));
check("Manifest remains standalone installable", manifest.display === "standalone" && Array.isArray(manifest.icons) && manifest.icons.length >= 2);

let failed = 0;
for (const item of checks) {
  if (!item.ok) failed += 1;
  console.log(`${item.ok ? "PASS" : "FAIL"}: ${item.name}`);
}
if (failed) {
  console.error(`\n${failed}/${checks.length} BAT-11/BAT-10/future checks failed.`);
  process.exit(1);
}
console.log(`\nBAT-11/BAT-10/future verification passed (${checks.length}/${checks.length}).`);
