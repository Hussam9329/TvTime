import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");
const failures = [];
const check = (condition, message) => { if (!condition) failures.push(message); };
const tmdb = read("src/lib/tmdb.ts");
const filtered = read("src/app/api/discover/filtered/route.ts");
const arabicTv = read("src/components/views/arabic-tv-view.tsx");
const anime = read("src/components/views/anime-view.tsx");

check(!fs.existsSync(path.join(root, "src/components/views/lists-view.tsx")), "Removed Custom Lists view still exists");
check(!tmdb.includes("with_text_query"), "Unsupported TMDB with_text_query is still emitted");
check(tmdb.includes("with_keywords") && tmdb.includes("searchKeywords"), "Keyword text is not resolved to TMDB keyword IDs");
check(filtered.includes("db.watchedEpisode.findMany") && filtered.includes("buildSeenIdSet"), "TV Seen semantics do not include episode progress");
check(arabicTv.includes('<DiscoverView world="arabic-tv"'), "Arabic TV still uses the disconnected Discover implementation");
check(anime.includes('mediaType={mediaType}') && anime.includes('mediaType === "movie"'), "Anime Discover/Releases does not expose movies and series");

if (failures.length) {
  console.error("Patch 08 verification failed:\n- " + failures.join("\n- "));
  process.exit(1);
}
console.log("Patch 08 static verification passed.");
