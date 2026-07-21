import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");
const failures = [];
const check = (condition, message) => { if (!condition) failures.push(message); };

const lists = read("src/components/views/lists-view.tsx");
const tmdb = read("src/lib/tmdb.ts");
const filtered = read("src/app/api/discover/filtered/route.ts");
const middleware = read("src/middleware.ts");
const arabicTv = read("src/components/views/arabic-tv-view.tsx");
const anime = read("src/components/views/anime-view.tsx");

check(!lists.includes("/api/tmdb/search/multi?query="), "Custom Lists still uses the broken TMDB search contract");
check(lists.includes("/api/tmdb/search"), "Custom Lists does not use the supported search endpoint");
check(lists.includes("readApiJson"), "List mutations do not consistently verify HTTP responses");
check(lists.includes("SafeImage"), "List posters are still placeholders");
check(lists.includes("<Dialog"), "List dialogs are not using the shared accessible primitive");
check(fs.existsSync(path.join(root, "src/app/list/[slug]/page.tsx")), "Public list page is missing");
check(fs.existsSync(path.join(root, "src/app/api/public/lists/[slug]/route.ts")), "Public list API is missing");
check(middleware.includes('"/list"') && middleware.includes('"/api/public"'), "Public list paths are still blocked by authentication middleware");
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
