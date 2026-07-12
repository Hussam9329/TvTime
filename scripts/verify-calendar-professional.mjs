#!/usr/bin/env node
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const root = process.cwd();
const read = (path) => readFileSync(resolve(root, path), "utf8");
const passed = [];
const failed = [];
const check = (condition, message) => (condition ? passed : failed).push(message);

const route = read("src/app/api/calendar/route.ts");
const calendar = read("src/components/views/calendar-view.tsx");
const hooks = read("src/hooks/use-tmdb.ts");
const dates = read("src/lib/date-only.ts");
const movie = read("src/components/views/movie-detail-view.tsx");
const schema = read("prisma/schema.prisma");

check(/MAX_RANGE_DAYS\s*=\s*62/.test(route), "Calendar API bounds requested ranges");
check(/type:\s*"series",\s*isFollowing:\s*true/.test(route), "Calendar uses explicit followed-series membership");
check(/watchedEpisode\.findMany/.test(route), "Calendar reads watched state from the canonical episode table");
check(/tmdb\.tvDetail/.test(route) && /tmdb\.seasonDetail/.test(route), "Calendar resolves exact TMDB episode air dates");
check(/mapWithConcurrency/.test(route) && /SHOW_CONCURRENCY/.test(route), "Calendar API limits concurrent TMDB work");
check(/partial:\s*warnings\.length\s*>\s*0/.test(route), "Partial TMDB failures are surfaced without hiding successful schedules");
check(/Cache-Control":\s*"private, no-store"/.test(route), "User watch state is never publicly cached");
check(!/useShowProgress/.test(calendar), "Calendar no longer creates per-show hooks inside every day cell");
check(!/toISOString\(\)\.slice\(0,\s*10\)/.test(calendar), "Calendar no longer converts local dates through UTC");
check(/"month"\s*\|\s*"week"\s*\|\s*"agenda"/.test(calendar), "Month, Week and Agenda modes are implemented");
check(/"upcoming"[\s\S]*"aired"[\s\S]*"unwatched"[\s\S]*"watched"[\s\S]*"tv"[\s\S]*"anime"/.test(calendar), "Calendar includes useful status and world filters");
check(/Search shows or episodes/.test(calendar), "Calendar can search shows and episode names");
check(/CalendarLoading/.test(calendar) && /CalendarError/.test(calendar) && /EmptyCalendar/.test(calendar), "Calendar has loading, error and empty states");
check(/EpisodeSheet/.test(calendar) && /Mark watched/.test(calendar) && /Open show/.test(calendar), "Episode details support direct actions");
check(/isFuture && !episode\.watched/.test(calendar), "Future episodes cannot be marked watched from the calendar");
check(/useCalendarSchedule/.test(hooks) && /\/api\/calendar/.test(hooks), "Client uses the unified calendar endpoint");
check((hooks.match(/queryKey:\s*\["calendar"\]/g) || []).length >= 2, "Episode mutations invalidate calendar data immediately");
check(/dateOnlyFromLocalDate/.test(dates) && /getFullYear\(\)/.test(dates), "Date keys are built from local calendar fields");
check(!/toISOString/.test(dates), "Date-only utilities never round-trip through UTC ISO timestamps");
check(/formatReleaseDateParts/.test(movie), "Movie details use the shared release date formatter");
check(/releaseDate\.dayMonth/.test(movie) && /releaseDate\.year/.test(movie), "Movie hero shows day/month with a separately emphasized year");
check(/releaseDate\?\.full/.test(movie), "Movie detail card shows the full human-readable release date");
check(!/backdrop\s+String\?/.test(schema), "Calendar change adds no speculative database field");

try {
  execFileSync(process.execPath, ["--experimental-strip-types", "scripts/test-calendar-date-only.ts"], {
    cwd: root,
    stdio: "pipe",
  });
  passed.push("Calendar date-only regression tests passed");
} catch (error) {
  failed.push(`Calendar date-only regression tests failed: ${error?.stderr?.toString?.() || error}`);
}

for (const message of passed) console.log(`PASS: ${message}`);
if (failed.length) {
  for (const message of failed) console.error(`FAIL: ${message}`);
  console.error(`\nProfessional calendar verification failed (${failed.length} failure(s)).`);
  process.exit(1);
}
console.log(`\nProfessional calendar verification passed (${passed.length} checks).`);
