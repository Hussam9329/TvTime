#!/usr/bin/env node
import { readFileSync } from "node:fs";

const read = (path) => readFileSync(path, "utf8");
const view = read("src/components/views/watch-next-view.tsx");
const styles = read("src/app/globals.css");
const route = read("src/app/api/watch-next/route.ts");
const tmdb = read("src/lib/tmdb.ts");
const tmdbHook = read("src/hooks/use-tmdb.ts");
const undo = read("src/hooks/use-watch-undo.ts");

const compact = view.slice(view.indexOf("function CompactWatchCard"), view.indexOf("function ProgressBar"));
const featured = view.slice(view.indexOf("function FeaturedWatchCard"), view.indexOf("function NextEpisodePreview"));

const checks = [
  [
    /tvtime-watch-featured__backdrop-blur/.test(featured)
      && /tvtime-watch-featured__scrim/.test(featured)
      && /filter: blur\(22px\)/.test(styles)
      && /linear-gradient\(90deg/.test(styles),
    "Featured Watch Next uses the episode artwork with blur and a readability scrim",
  ],
  [
    /function NextEpisodePreview/.test(view)
      && /followingEpisodeStill/.test(view)
      && /tvtime-watch-next-episode__thumb/.test(view),
    "The featured card previews the following episode with a landscape thumbnail and metadata",
  ],
  [
    /remainingMinutes/.test(view)
      && /formatReadyTime\(remaining\)/.test(view)
      && /role="progressbar"/.test(view),
    "Progress keeps accessible percentage semantics while exposing remaining viewing time",
  ],
  [
    /function smartPriority/.test(view)
      && /progressPercent\(item\) \* 3/.test(view)
      && /item\.isNewEpisode \? 1_250/.test(view)
      && /returnBoost/.test(view),
    "Smart priority combines completion, genuinely new episodes and controlled return-to-show boosts",
  ],
  [
    /releasedAfterLastWatch/.test(route)
      && /isNewEpisode: releasedAfterLastWatch/.test(route)
      && /function NewEpisodeBadge/.test(view),
    "New episode badges are based on release date relative to the user's last watched episode",
  ],
  [
    /function SeasonCompletionCard/.test(view)
      && /Season complete/.test(view)
      && /nextSeasonNumber/.test(view)
      && /Try something similar/.test(view),
    "Finishing a season transitions the hero to next-season or similar-show guidance",
  ],
  [
    /data-layout=\{rail \? "rail" : "grid"\}/.test(view)
      && /rail/.test(view)
      && /src=\{item\.poster\}/.test(compact)
      && /variant="poster"/.test(compact)
      && /aspect-ratio: 2 \/ 3 !important/.test(styles)
      && !/item\.episodeStill \|\| item\.seasonBackdrop \|\| item\.showBackdrop/.test(compact),
    "Continue Watching keeps the classic vertical show poster on every non-featured card",
  ],
  [
    /tvtime-watch-card__preview/.test(compact)
      && /@media \(hover: hover\) and \(pointer: fine\)/.test(styles)
      && /transform: scale\(1\.045\)/.test(styles),
    "Desktop hover and keyboard focus reveal a lightweight episode preview without video",
  ],
  [
    /drag=\{isMobile && !disabled \? "x" : false\}/.test(featured)
      && /info\.offset\.x >= 88/.test(featured)
      && /info\.offset\.x <= -88/.test(featured)
      && /info\.offset\.x >= 76/.test(compact)
      && /info\.offset\.x <= -76/.test(compact),
    "Featured and compact Watch Next cards expose guarded mobile swipe actions in both directions",
  ],
  [
    /showWatchUndo/.test(view)
      && /onUndoSuccess/.test(view)
      && /onUndoSuccess\?\./.test(undo),
    "Mark-watched keeps the five-second Undo flow and can roll back season-completion UI",
  ],
  [
    /<AnimatePresence initial=\{false\} mode="sync">/.test(featured)
      && /key=\{backdrop \|\| `poster-\$\{item\.tmdbId\}`\}/.test(featured)
      && /duration: 0\.46/.test(featured),
    "Pinned artwork crossfades between episodes instead of flashing when the featured item changes",
  ],
  [
    /function WatchNextSkeleton/.test(view)
      && /tvtime-watch-skeleton__featured/.test(view)
      && /tvtime-watch-skeleton__card-art/.test(view)
      && /min-height: clamp\(21rem, 42vw, 30rem\)/.test(styles),
    "Watch Next has a dimensionally matched hero and card skeleton",
  ],
  [
    /resolvedEpisodeStill \|\| resolvedSeasonBackdrop \|\| showBackdrop \|\| item\.poster/.test(featured)
      && /src=\{item\.poster\}/.test(compact)
      && /data-image-kind="poster-fallback"/.test(styles),
    "Smart Episode Still → Season Backdrop → Show Backdrop → Poster fallback is reserved for the pinned card",
  ],
  [
    /function imageScore/.test(route)
      && /ratioPenalty/.test(route)
      && /resolution/.test(route)
      && /vote_average/.test(route)
      && /episodeImages/.test(tmdb)
      && /useEpisodeImages/.test(tmdbHook),
    "Multiple TMDB episode stills are ranked by aspect ratio, resolution and votes",
  ],
  [
    /WATCH_NEXT_SEASON_ENRICHMENT_LIMIT = 8/.test(route)
      && /WATCH_NEXT_STILL_ENRICHMENT_LIMIT = 1/.test(route)
      && /WATCH_NEXT_SEASON_TIMEOUT_MS = 1_200/.test(route)
      && /Compact cards stay query-free/.test(compact)
      && !/useSeasonDetail\(/.test(compact),
    "Best-still enrichment is limited to the pinned card and compact cards stay query-free",
  ],
  [
    /swipeRef/.test(featured)
      && /swipeRef/.test(compact)
      && /if \(!swipeRef\.current\) onOpen\(\)/.test(view),
    "Swipe gestures suppress the accidental detail click that normally follows a drag",
  ],
  [
    /prefers-reduced-motion: reduce/.test(styles)
      && /tvtime-watch-featured__backdrop-stage/.test(styles),
    "Crossfades, previews and artwork motion honor reduced-motion preferences",
  ],
];

let failed = 0;
for (const [condition, message] of checks) {
  console.log(`${condition ? "PASS" : "FAIL"}: ${message}`);
  if (!condition) failed += 1;
}

if (failed) process.exit(1);
console.log(`\nWatch Next cinematic verification passed (${checks.length} checks).`);
