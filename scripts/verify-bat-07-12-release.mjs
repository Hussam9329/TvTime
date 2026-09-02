import fs from "node:fs";

const checks = [];
const failures = [];

function file(path) {
  return fs.readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
}
function expect(name, condition) {
  checks.push(name);
  if (!condition) failures.push(name);
}

const tvApi = file("src/app/api/tv-tracking/route.ts");
const tvView = file("src/components/views/tv-tracking-view.tsx");
const hooks = file("src/hooks/use-tmdb.ts");
const statsApi = file("src/app/api/library/stats/route.ts");
const statsView = file("src/components/views/stats-view.tsx");
const genreProfile = file("src/lib/genre-profile.ts");
const schema = file("prisma/schema.prisma");

expect("Media.genres is persisted String[]", /genres\s+String\[\]/.test(schema));
expect("TV API accepts genre", /searchParams\.get\("genre"\)/.test(tvApi));
expect("TV API filters genres server-side", /filteredByGenre/.test(tvApi) && /mediaHasGenre\(show\.genres, genre\)/.test(tvApi));
expect("TV hook accepts genre", /search\?: string;\s*genre\?: string;/s.test(hooks));
expect("TV UI exposes genre state", /const \[genre, setGenre\]/.test(tvView));
expect("TV UI sends genre with search/status/sort", /genre: genre \|\| undefined/.test(tvView));
expect("TV UI has canonical Sci-Fi & Fantasy value", /Sci-Fi & Fantasy/.test(tvView));
expect("BAT-06 search remains enabled", /debouncedSearch/.test(tvView) && /sortBy/.test(tvView));
expect("Stats API returns genreDistribution", /genreDistribution,/.test(statsApi));
expect("Stats API calculates distribution through shared logic", /buildGenreDistribution\(watchedMedia\)/.test(statsApi));
expect("Shared genre profile calculates percentages", /percentage: totalGenreTags/.test(genreProfile));
expect("Shared genre profile reports coverage", /coveragePercentage/.test(genreProfile));
expect("Stats UI renders real percentages", /item\.percentage/.test(statsView) && /Genre coverage/.test(statsView));

console.log(`BAT-07 + BAT-12 stabilization checks: ${checks.length - failures.length}/${checks.length} passed`);
if (failures.length) {
  console.error("Failed checks:");
  for (const failure of failures) console.error(` - ${failure}`);
  process.exit(1);
}
console.log("PASS: BAT-07 + release stabilization invariants + BAT-12 are structurally consistent.");
