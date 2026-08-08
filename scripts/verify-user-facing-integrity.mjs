#!/usr/bin/env node
import { execFileSync } from "node:child_process";
import { createRequire } from "node:module";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { relative, resolve } from "node:path";

const root = process.cwd();
const require = createRequire(import.meta.url);
const passed = [];
const failed = [];
const read = (path) => readFileSync(resolve(root, path), "utf8");
const check = (condition, message) => (condition ? passed : failed).push(message);

function walk(dir) {
  return readdirSync(dir).flatMap((entry) => {
    if (["node_modules", ".next", ".git"].includes(entry)) return [];
    const absolute = resolve(dir, entry);
    return statSync(absolute).isDirectory() ? walk(absolute) : [absolute];
  });
}

const profile = read("src/components/profile/profile-dialog.tsx");
const clearRoute = read("src/app/api/library/clear/route.ts");
const store = read("src/lib/store.ts");
const providers = read("src/components/providers.tsx");
const clientUser = read("src/lib/client-user.ts");
const watchedEpisodes = read("src/app/api/library/watched-episodes/route.ts");
const tracking = read("src/app/api/tv-tracking/route.ts");
const repair = read("src/lib/tv-status-repair.ts");
const collection = read("src/components/views/collection-world-view.tsx");
const counts = read("src/lib/library-counts.ts");
const hooks = read("src/hooks/use-tmdb.ts");
const shortcuts = read("src/components/layout/keyboard-shortcuts.tsx");
const shell = read("src/components/app-shell.tsx");
const header = read("src/components/layout/header.tsx");
const footer = read("src/components/layout/footer.tsx");
const login = read("src/app/login/page.tsx");
const brand = read("src/lib/brand.ts");
const brandLogo = read("src/components/ui/brand-logo.tsx");
const rootLayout = read("src/app/layout.tsx");
const manifest = read("public/manifest.webmanifest");
const publicLogo = read("public/logo.svg");
const searchView = read("src/components/views/search-view.tsx");
const mediaCard = read("src/components/media/media-card.tsx");
const compactScoreCorner = read("src/components/media/compact-score-corner.tsx");
const watchedIndicator = read("src/components/media/watched-indicator.tsx");
const tmdbIndicator = read("src/components/media/tmdb-score-indicator.tsx");
const watchlistIndicator = read("src/components/media/watchlist-indicator.tsx");
const globalStyles = read("src/app/globals.css");
const tvTrackingView = read("src/components/views/tv-tracking-view.tsx");
const movieDetailView = read("src/components/views/movie-detail-view.tsx");
const tvDetailView = read("src/components/views/tv-detail-view.tsx");
const ratingDialog = read("src/components/media/rating-dialog.tsx");
const discoverView = read("src/components/views/discover-view.tsx");
const releaseSchedule = read("src/components/views/movie-release-schedule.tsx");
const filterPanel = read("src/components/ui/filter-panel.tsx");
const pageTitlebar = read("src/components/ui/page-titlebar.tsx");
const moviesView = read("src/components/views/movies-view.tsx");
const tvWorldPageView = read("src/components/views/tv-world-page-view.tsx");
const animeView = read("src/components/views/anime-view.tsx");
const arabicMoviesView = read("src/components/views/arabic-movies-view.tsx");
const statsView = read("src/components/views/stats-view.tsx");
const watchNextView = read("src/components/views/watch-next-view.tsx");
const movieMediaRoute = read("src/app/api/media/[id]/route.ts");
const watchedMoviesRoute = read("src/app/api/library/watched-movies/route.ts");
const completionInvariant = read("src/lib/completion-rating-invariant.ts");
const watchNextRoute = read("src/app/api/watch-next/route.ts");
const watchNextState = read("src/lib/watch-next-state.ts");
const importValidation = read("src/lib/library-import-validation.ts");
const mediaListRoute = read("src/app/api/media/route.ts");
const mediaStatesRoute = read("src/app/api/media/states/route.ts");
const mediaStateRoute = read("src/app/api/media/state/route.ts");
const mediaRecentlyRoute = read("src/app/api/media/recently/route.ts");
const followingRoute = read("src/app/api/library/following/route.ts");
const classificationResolver = read("src/lib/media-classification-resolver-server.ts");
const tmdbClient = read("src/lib/tmdb.ts");
const discoverFilteredRoute = read("src/app/api/discover/filtered/route.ts");
const tmdbProxyRoute = read("src/app/api/tmdb/[...path]/route.ts");
const pkg = JSON.parse(read("package.json"));
const schemaVerifier = read("scripts/verify-required-schema.mjs");

check(/"x-confirm-delete":\s*"DELETE EVERYTHING"/.test(profile), "Clear-all UI sends the exact destructive-operation confirmation token");
check(/const CONFIRMATION = "DELETE EVERYTHING"/.test(clearRoute)
  && /req\.headers\.get\("x-confirm-delete"\) !== CONFIRMATION/.test(clearRoute), "Clear-all API rejects requests without the exact confirmation token");
check(/db\.\$transaction\(async \(tx\) =>/.test(clearRoute)
  && /tx\.media\.deleteMany/.test(clearRoute)
  && /tx\.watchSession\.deleteMany/.test(clearRoute)
  && /tx\.notification\.deleteMany/.test(clearRoute), "Clear-all deletes the declared user-owned lifecycle atomically");

check(/return DEFAULT_USER_ID/.test(clientUser), "Client API identity is the canonical default user");
check(/userId:\s*DEFAULT_USER_ID/.test(store), "Navigation/profile store starts with the canonical user identity");
check(/partialize:\s*\(state\)\s*=>\s*\(\{\s*userName:/.test(store), "Random or stale user identifiers are not persisted");
check(/merge:[\s\S]*userId:\s*DEFAULT_USER_ID/.test(store), "Previously persisted random user identifiers are corrected during hydration");
check(/hydrateCanonicalProfile/.test(providers) && /\/api\/user/.test(providers), "Display name is hydrated from the same server user as the library");
check(
  /APP_NAME = "Trakora"/.test(brand)
    && /APP_TAGLINE = "Track every story"/.test(brand)
    && /BACKUP_FILE_PREFIX = "trakora-backup"/.test(brand)
    && /LEGACY_APP_ALIASES = \["TvTime", "CineTrack"\]/.test(brand),
  "Trakora is canonical while backups from both previous product names remain import-compatible",
);
check(
  [header, footer, login].every((source) => /<BrandMark/.test(source))
    && [header, footer, login].every((source) => /<BrandWordmark/.test(source))
    && /Trak<span className="text-primary">ora<\/span>/.test(brandLogo)
    && /m24\.25 17\.25 5\.25 3\.5-5\.25 3\.5/.test(brandLogo),
  "Header, footer and login share the Trakora wordmark and playback-tracking monogram",
);
check(
  /default: `\$\{APP_NAME\} — Movies, TV Shows & Anime`/.test(rootLayout)
    && /url: "\/og-image\.png"/.test(rootLayout)
    && /"name": "Trakora"/.test(manifest)
    && /"short_name": "Trakora"/.test(manifest)
    && /<title id="title">Trakora<\/title>/.test(publicLogo)
    && /#d8a34c/.test(publicLogo)
    && /\/logo\.svg\?v=4/.test(rootLayout),
  "Browser, installable app and social metadata expose the new Trakora identity",
);

check(/persist:\s*false/.test(watchedEpisodes), "Legacy whole-show snapshots are read without database writes during GET");
check(/_virtualLegacySnapshot/.test(watchedEpisodes), "Legacy completion is represented immediately as a virtual episode snapshot");
check((watchedEpisodes.match(/db\.\$transaction\(async \(tx\)/g) || []).length >= 2, "Legacy snapshot persistence and episode changes are transactional");
check((watchedEpisodes.match(/tx\.watchedEpisode\.createMany/g) || []).length >= 2, "Legacy episodes are materialized before add/remove mutations");
check(/attempted && !legacySnapshot\.verified/.test(watchedEpisodes), "Episode mutations fail closed when legacy completion cannot be verified");
check(/verified:\s*boolean/.test(repair) && /verified:\s*false/.test(repair), "Legacy snapshot repair exposes explicit verification status");

check(
  /safeUnverifiedState[\s\S]*watchedEpisodes\.length > 0[\s\S]*"watching"[\s\S]*tvStateToMediaPatch\(effectiveState/.test(watchedEpisodes),
  "Unverified episode progress persists only a safe non-completion state",
);
check(
  /Could not verify the TV metadata\. No progress was changed\./.test(watchedEpisodes)
    && watchedEpisodes.indexOf("loadMutationMetadata(showId, now)") < watchedEpisodes.indexOf("db.$transaction"),
  "TMDB failure blocks episode mutations before their transaction",
);
check(
  /const effectiveState = persisted === "stopped"[\s\S]*derived\.verified[\s\S]*watched\.count > 0[\s\S]*\? "watching"/.test(tracking),
  "TV tracking display preserves real episode progress when cache verification is incomplete",
);
check(
  [tracking, counts, mediaListRoute, mediaStatesRoute, mediaStateRoute, mediaRecentlyRoute, watchNextRoute, followingRoute]
    .every((source) => /resolveGeneralMediaClassifications\([^;]*\{ allowNetwork: false \}\)/s.test(source))
    && /if \(options\.allowNetwork === true\)/.test(classificationResolver),
  "Library and tracking read paths stay cache-only instead of requesting TMDB once per title",
);
check(
  !/localizeArabicPosters/.test(tmdbClient)
    && !/localized(?:Movie|Tv)Profile/.test(mediaListRoute)
    && !/enrichMovieOriginCountries/.test(discoverFilteredRoute)
    && !/enrichMovieOriginCountries/.test(tmdbProxyRoute),
  "Discover and Arabic library lists avoid per-card localization and origin-detail fan-out",
);

check(/type CollectionTab = "watchlist" \| "not-started" \| "watching" \| "watched"/.test(collection), "Anime collection models Watchlist, Not Started, In Progress and Watched separately");
check(
  /const usesHomePosterGrid = world === "movies" && layout === "grid"/.test(collection)
    && /usesHomePosterGrid \? HOME_MEDIA_CARD_GRID_CLASS/.test(collection)
    && /homePresentation=\{world === "movies"\}/.test(collection)
    && /tvtime-media-card group relative min-w-0/.test(collection)
    && /tvtime-media-poster relative aspect-\[2\/3\]/.test(collection)
    && /tvtime-media-copy/.test(collection),
  "Movie Watchlist and Watched grids reuse Home's responsive poster presentation",
);
check(
  /<WatchlistIndicator \/>/.test(mediaCard)
    && /tab === "watchlist" && <WatchlistIndicator \/>/.test(collection)
    && /trackingStatus === "planned" && <WatchlistIndicator \/>/.test(tvTrackingView)
    && /data-state="watchlist"/.test(watchlistIndicator)
    && /Bookmark className="fill-current"/.test(watchlistIndicator)
    && /--cinema-purple: #a78bfa/.test(globalStyles)
    && /\.tvtime-watchlist-indicator\s*\{[\s\S]*border: 1px solid var\(--cinema-purple-line\)[\s\S]*border-radius: 0\.55rem 1\.02rem 0\.55rem 0\.55rem[\s\S]*color: var\(--cinema-purple\)/.test(globalStyles)
    && /ListPlus \/> \{inWatchlist \? "Remove from watchlist" : "Add to watchlist"\}/.test(mediaCard)
    && /Remove from watchlist/.test(collection),
  "Watchlist membership uses one compact purple bookmark badge while actions remain available",
);
check(/value="not-started"/.test(collection) && /Not Started/.test(collection), "Anime not-started titles remain visible in their own tab");
check(/status:\s*"not_started",\s*watched:\s*"false",\s*tracked:\s*"true"/.test(collection), "Anime Not Started requires explicit following membership and no watched progress");
check(/value="watching"/.test(collection) && /In Progress/.test(collection), "Anime in-progress is visible and selectable");
check(/status:\s*"watching,uptodate"/.test(collection), "Anime In Progress includes only actual episode-progress states");
check(!/status:\s*"not_started,watching,uptodate"/.test(collection), "Anime In Progress no longer mislabels Not Started titles");
check(/notStartedAnime/.test(counts) && /item\.isFollowing/.test(counts) && /item\.status === "not_started"/.test(counts), "Anime Not Started badge is counted from explicit following membership");
check(/watchingAnime/.test(counts) && /isWatching\(item\.status\)/.test(counts) && /status === "watching" \|\| status === "uptodate"/.test(counts), "Anime In Progress badge counts only Watching and Up To Date");
check(/notStartedAnime\?:\s*number/.test(hooks) && /watchingAnime\?:\s*number/.test(hooks), "Client stats contract exposes both Anime state counters");
check(!/finished-anime/.test(tracking) && !/finishedAnime/.test(hooks), "TV Tracking no longer exposes the unreachable Finished Anime category");
check(/INVALID_TV_TRACKING_CATEGORY/.test(tracking) && /status:\s*400/.test(tracking), "Unknown TV Tracking categories fail explicitly instead of silently returning All");

const sequenceAt = shortcuts.indexOf('lastKeyRef.current === "g"');
const standaloneAt = shortcuts.indexOf('e.key.toLowerCase() === "s"');
check(sequenceAt >= 0 && standaloneAt > sequenceAt, "g+s navigation is resolved before the standalone search shortcut");
check(!/view === "media" && <MediaView/.test(shell), "The removed My Media route is still rendered");
check(
  /const searchQuery = useNav/.test(header)
    && /view === "search"\) setSearchVal\(searchQuery\)/.test(header),
  "Header search stays synchronized with the active results query",
);
check(
  !/<Input/.test(searchView)
    && !/const \[local,\s*setLocal\] = useState\(searchQuery\)/.test(searchView)
    && !/setTimeout\([\s\S]*setSearchQuery/.test(searchView),
  "Search results render no competing input that can restore a stale query",
);
check(
  /const finished = mediaType === "tv" && libraryState\?\.status === "finished"/.test(mediaCard)
    && /const completed = watched \|\| finished/.test(mediaCard)
    && /status=\{finished \? "finished" : "watched"\}/.test(mediaCard),
  "Finished TV cards use the same completed-media indicator as watched movies",
);
check(
  /scoreSource="user"/.test(watchedIndicator)
    && /suffix="\/100"/.test(watchedIndicator)
    && /status\?: "watched" \| "finished"/.test(watchedIndicator),
  "Green completed-media indicator identifies the user's score out of 100",
);
check(
  /<CompactScoreCorner/.test(watchedIndicator)
    && /<CompactScoreCorner/.test(tmdbIndicator)
    && /side="left"/.test(watchedIndicator)
    && /side="right"/.test(tmdbIndicator)
    && /left: "-left-px flex-row rounded-\[9px\]"/.test(compactScoreCorner)
    && /right: "-right-px flex-row rounded-\[9px\]"/.test(compactScoreCorner)
    && /absolute -top-px z-20/.test(compactScoreCorner)
    && /h-\[24px\] min-w-\[58px\]/.test(compactScoreCorner)
    && /text-\[10px\] font-bold/.test(compactScoreCorner)
    && /overflow-hidden border px-1\.5 backdrop-blur-md/.test(compactScoreCorner),
  "Both compact score badges share one exact rounded outlined geometry",
);
check(
  /scoreSource="tmdb"/.test(tmdbIndicator)
    && /out of 10/.test(tmdbIndicator)
    && /suffix="\/10"/.test(tmdbIndicator),
  "Yellow catalogue indicator identifies the TMDB score out of 10",
);
check(
  /!completed && <TmdbScoreIndicator rating=\{item\.vote_average\}/.test(mediaCard)
    && /className="tvtime-tmdb-score"[\s\S]*side="right"/.test(tmdbIndicator)
    && /\.tvtime-tmdb-score\s*\{[\s\S]*right: -1px !important[\s\S]*left: auto !important/.test(globalStyles),
  "Uncompleted media keeps the TMDB score in the opposite top corner",
);
check(
  /trackingStatus === "finished"[\s\S]*<WatchedIndicator rating=\{userRating\} status="finished"/.test(tvTrackingView)
    && /trackingStatus !== "finished"[\s\S]*<TmdbScoreIndicator rating=\{tmdbRating\}/.test(tvTrackingView),
  "TV tracking posters separate finished user scores from unfinished TMDB scores",
);
check(
  !/WatchedIndicator|TmdbScoreIndicator/.test(movieDetailView),
  "Movie detail keeps the main poster free of corner rating indicators",
);
check(
  /tvtime-rating-dialog/.test(ratingDialog)
    && /DialogHeader className="relative top-auto[^"]*bg-transparent/.test(ratingDialog)
    && /DialogFooter className="static[^"]*grid grid-cols-/.test(ratingDialog),
  "Rating dialog uses one coherent non-sticky surface without nested header or footer frames",
);
check(
  /grid grid-cols-5 gap-2/.test(ratingDialog)
    && /aria-label="Personal rating out of 100"/.test(ratingDialog)
    && /aria-pressed=\{rating === value\}/.test(ratingDialog),
  "Rating dialog keeps its slider and five quick values aligned and accessible",
);
check(
  /pinnedContent=\{\(/.test(discoverView)
    && /tvtime-discover-quick-picks/.test(discoverView)
    && /tvtime-discover-preset-row/.test(discoverView)
    && /pinnedContent\?: ReactNode/.test(filterPanel)
    && /tvtime-filter-panel-pinned/.test(filterPanel),
  "Discover quick picks stay attached to the filter console and visible above mobile filter details",
);
check(
  /tvtime-discover-control-section/.test(discoverView)
    && /tvtime-discover-status-toggle/.test(discoverView)
    && /tvtime-discover-advanced-trigger/.test(discoverView)
    && /tvtime-discover-results-bar/.test(discoverView)
    && /\.tvtime-discover-preset-row\s*\{[\s\S]*grid-template-columns: repeat\(auto-fit/.test(globalStyles)
    && /@media \(max-width: 767px\)[\s\S]*\.tvtime-discover-preset-row\s*\{[\s\S]*overflow-x: auto/.test(globalStyles),
  "Discover controls use one aligned desktop hierarchy with a compact mobile quick-pick rail",
);
check(
  (discoverView.match(/presentation="home"/g) || []).length >= 2
    && /presentation="home"/.test(releaseSchedule)
    && /libraryStatesReady=\{releaseLibraryStates\.isSuccess\}/.test(releaseSchedule)
    && /const gridClassName = presentation === "home" \? HOME_MEDIA_CARD_GRID_CLASS/.test(mediaCard)
    && /\.tvtime-home-media-grid\s*\{[\s\S]*grid-template-columns: repeat\(auto-fill, minmax\(min\(8\.75rem, 100%\), 10rem\)\)/.test(globalStyles)
    && /@media \(min-width: 768px\)[\s\S]*\.tvtime-home-media-grid\s*\{[\s\S]*grid-template-columns: repeat\(auto-fill, clamp\(9\.4rem, 12vw, 11\.25rem\)\)/.test(globalStyles),
  "Discover and release posters use Home's shared card presentation and sizing",
);
check(
  [moviesView, tvWorldPageView, animeView, arabicMoviesView, searchView, statsView, watchNextView, discoverView]
    .every((source) => /<PageTitlebar title=/.test(source))
    && /tvtime-page-titlebar/.test(pageTitlebar)
    && /\.tvtime-page-titlebar\s*\{[\s\S]*min-height: 2\.75rem/.test(globalStyles)
    && /\.tvtime-page-titlebar h1\s*\{[\s\S]*font-size: clamp\(1\.2rem, 2vw, 1\.5rem\)/.test(globalStyles),
  "Top-level pages use one compact title-only heading instead of repeated hero descriptions",
);
check(
  !/Track films you've watched/.test(moviesView)
    && !/data-ui-surface="hero"/.test(moviesView)
    && !/data-ui-surface="hero"/.test(tvWorldPageView)
    && !/Personal queue/.test(watchNextView)
    && !/Universal search/.test(searchView)
    && !/Welcome back/.test(statsView),
  "Large duplicate page-identification banners stay removed from catalogue and utility views",
);
check(
  /className="tvtime-detail-hero__actions tvtime-movie-detail-hero__actions"/.test(movieDetailView)
    && /className="tvtime-detail-hero__actions tvtime-tv-detail-hero__actions"/.test(tvDetailView)
    && /tvtime-tv-detail-hero__poster-action[\s\S]*<OfficialPosterPicker/.test(tvDetailView)
    && /\.tvtime-detail-hero__actions\s*\{[\s\S]*grid-template-columns: repeat\(auto-fit, minmax\(9\.5rem, 1fr\)\)[\s\S]*grid-auto-rows: 3rem/.test(globalStyles)
    && !/tvtime-tv-detail-hero__actions flex flex-wrap/.test(tvDetailView),
  "Movie and TV detail actions share one responsive button grid",
);
check(
  /\.tvtime-tv-detail-hero__actions\s*\{[\s\S]*grid-template-columns: repeat\(auto-fill, minmax\(8\.75rem, 10\.5rem\)\)[\s\S]*grid-auto-rows: 2\.5rem[\s\S]*justify-content: start/.test(globalStyles)
    && /\.tvtime-tv-detail-hero__actions :is\(\[data-slot="button"\], \.tvtime-tv-detail-hero__watch-button\)\s*\{[\s\S]*max-height: 2\.5rem[\s\S]*font-size: 0\.78rem/.test(globalStyles),
  "TV detail buttons stay compact instead of stretching across the hero",
);
check(
  /className="tvtime-tv-detail-hero__meta"/.test(tvDetailView)
    && !/tvtime-tv-detail-hero__meta[^\n]*\[&>\*\]:h-10/.test(tvDetailView)
    && /\.tvtime-tv-detail-hero__meta > \*\s*\{[\s\S]*min-height: 2rem[\s\S]*padding: 0\.36rem 0\.62rem[\s\S]*border-radius: 999px[\s\S]*font-size: 0\.7rem/.test(globalStyles),
  "TV type, state, year, seasons, score and certification render as compact metadata chips",
);
check(
  (tvTrackingView.match(/\{ value: "/g) ?? []).length === 9
    && ["all", "watchlist", "uptodate", "finished", "stopped", "upcoming", "havent-watched", "havent-started", "stale"].every((value) => tvTrackingView.includes(`{ value: "${value}"`))
    && /className="tvtime-tracking-status-grid"/.test(tvTrackingView)
    && /className=\{`tvtime-tracking-status-option/.test(tvTrackingView)
    && /\.tvtime-tracking-status-grid\s*\{[\s\S]*grid-template-columns: repeat\(3, minmax\(0, 1fr\)\)/.test(globalStyles)
    && /\.tvtime-tracking-status-option\s*\{[\s\S]*grid-template-columns: 1\.55rem minmax\(0, 1fr\) auto/.test(globalStyles),
  "Tracking status preserves all nine filters in one aligned option grid",
);
check(
  /if \(!isWatched\) \{\s*if \(myRating == null\)[\s\S]*setRatingIntent\("complete"\)/.test(movieDetailView)
    && /ratingIntent === "complete"[\s\S]*action: "add"[\s\S]*userRating: v/.test(movieDetailView)
    && /Closing or cancelling keeps it unwatched/.test(movieDetailView),
  "Movie details defer Watched until the required rating is submitted",
);
check(
  /if \(!watched\) \{\s*if \(userRating != null\)[\s\S]*setRatingOpen\(true\)/.test(mediaCard)
    && /action: "add",\s*userRating: rating/.test(mediaCard)
    && /Closing or cancelling keeps it unwatched/.test(mediaCard),
  "Poster-card Watched actions require the same rating-first flow",
);
check(
  /if \(isMovie && !item\.watched\)[\s\S]*userRating: rating[\s\S]*watched: true/.test(collection)
    && /Remove rating & watched/.test(collection),
  "Collection cards save movie completion atomically and cannot remove its rating alone",
);
check(
  /existing\.type === "series" && hasRatingMutation && hasWatchMutation/.test(movieMediaRoute)
    && /MOVIE_WATCHED_REQUIRES_RATING/.test(movieMediaRoute)
    && /finalWatched \|\| finalStatus === "watched"/.test(movieMediaRoute),
  "Media API permits atomic movie completion while rejecting watched movies without a rating",
);
check(
  /userRating < 0 \|\| userRating > 100/.test(watchedMoviesRoute)
    && /MOVIE_WATCHED_REQUIRES_RATING/.test(watchedMoviesRoute),
  "Compatibility Watched API also requires a valid personal movie rating",
);
check(
  /type: "movie",\s*status: "watched",\s*userRating: null/.test(completionInvariant)
    && /status: null,\s*watched: false,\s*watchedAt: null/.test(completionInvariant),
  "Historical watched movies without ratings are normalized back to unwatched",
);
check(
  /type: "series",\s*status: \{ in: \["finished", "completed", "watched"\] \},\s*userRating: null/.test(completionInvariant)
    && /status: "uptodate",\s*watched: false/.test(completionInvariant)
    && /TV_FINISHED_REQUIRES_RATING/.test(movieMediaRoute),
  "Finished TV series cannot persist without a personal rating",
);
check(
  /shouldExcludeFromWatchNext/.test(watchNextRoute)
    && /input\.officiallyEnded === true[\s\S]*input\.userRating != null[\s\S]*hasExplicitLegacyFinishedTag/.test(watchNextState)
    && /clearExplicitLegacyFinishedTag/.test(watchedEpisodes),
  "Watch Next preserves explicit rated legacy completions but releases them after an episode is unwatched",
);
check(
  /readyEpisodes: result\.readyEpisodes \+ item\.readyEpisodes/.test(watchNextRoute)
    && /estimatedMinutes: result\.estimatedMinutes \+ item\.readyEpisodes \* item\.estimatedRuntime/.test(watchNextRoute)
    && /episodes ready/.test(watchNextView)
    && /formatReadyTime\(estimatedMinutes\)/.test(watchNextView),
  "Watch Next summarizes every ready episode and its estimated viewing time",
);
check(
  /function FeaturedWatchCard/.test(watchNextView)
    && /Mark episode watched/.test(watchNextView)
    && /View episode/.test(watchNextView)
    && /onNotNow/.test(watchNextView)
    && /variant="backdrop" priority/.test(watchNextView)
    && /tvtime-watch-featured/.test(globalStyles),
  "Watch Next presents one cinematic lead episode with progress and direct actions",
);
check(
  ["Continue Watching", "New Episodes", "Falling Behind", "Up to Date", "Coming Soon", "Paused"]
    .every((label) => watchNextView.includes(label))
    && /readyEpisodes >= 3/.test(watchNextView)
    && /PAUSED_DAYS = 30/.test(watchNextView)
    && /<Collapsible open=\{open\}/.test(watchNextView),
  "Watch Next assigns each title to the requested logical queue section",
);
check(
  /function smartPriority/.test(watchNextView)
    && /item\.readyEpisodes === 1/.test(watchNextView)
    && /progressPercent\(item\) \* 3/.test(watchNextView)
    && /Reorder\.Group/.test(watchNextView)
    && /useDragControls/.test(watchNextView)
    && /localStorage\.setItem\(CUSTOM_ORDER_KEY/.test(watchNextView),
  "Watch Next combines smart priority with persisted mouse and touch reordering",
);
check(
  /tvtime-watch-personal-status/.test(watchNextView)
    && /Watching<\/span>/.test(watchNextView)
    && /rgb\(70 150 255/.test(globalStyles)
    && /tvtime-watch-next-page[\s\S]*safe-area-inset-bottom/.test(globalStyles),
  "Watch Next isolates the personal Watching state and clears the mobile navigation dock",
);
check(
  /if \(c\.needsRating\)[\s\S]*setPendingCompletionRating\(true\)[\s\S]*setRatingOpen\(true\)/.test(tvDetailView)
    && /Closing or cancelling keeps it Up To Date/.test(tvDetailView)
    && /Save rating & mark Finished/.test(tvDetailView),
  "TV completion stays non-Finished until its rating dialog is submitted",
);
check(
  /validWatchedMovie = parsed\.type === "movie" && parsed\.watched && parsed\.userRating !== null/.test(importValidation)
    && /watched: validWatchedMovie/.test(importValidation),
  "Library imports cannot reintroduce an unrated watched movie",
);

check(/verify-required-schema\.mjs/.test(pkg.scripts?.build || ""), "Production build verifies the required database contract before Next.js build");
check(pkg.scripts?.["db:migrate:status"]?.includes("prisma migrate status"), "A read-only migration status command is available");
check(pkg.scripts?.["db:migrate:deploy"]?.includes("prisma migrate deploy"), "Reviewed migrations have an explicit deployment command");
check(/Media:\s*\[[\s\S]*"isFollowing"/.test(schemaVerifier), "Schema guard verifies the dedicated following field");
check(/Media_userId_type_tmdbId_key/.test(schemaVerifier), "Schema guard verifies the canonical Media identity constraint");
check(/WHERE "type" = 'tv'/.test(schemaVerifier), "Schema guard rejects unnormalized legacy TV identities");
check(!/\b(prisma\s+db\s+push|prisma\s+migrate\s+reset)\b/i.test(pkg.scripts?.build || ""), "Build contains no destructive schema command");
check(pkg.scripts?.["verify:all"] === "node scripts/verify-all.mjs", "One comprehensive verification command covers the maintained project checks");

check(/errorBody\?\.error \|\| "Failed to unmark episode"/.test(hooks), "Episode removal surfaces the server's safety error to the user");
check(/payload\?\.user\?\.name/.test(profile), "Profile UI stores the server-normalized display name");

try {
  let compiler;
  try {
    compiler = require.resolve("typescript/lib/typescript.js");
  } catch {
    const globalRoot = execFileSync("npm", ["root", "-g"], { encoding: "utf8" }).trim();
    compiler = resolve(globalRoot, "typescript/lib/typescript.js");
  }
  const parser = `
    const fs=require('fs'),path=require('path'),ts=require(${JSON.stringify(compiler)});
    let files=[];(function walk(d){for(const e of fs.readdirSync(d,{withFileTypes:true})){const p=path.join(d,e.name);if(['node_modules','.next','.git'].includes(e.name))continue;if(e.isDirectory())walk(p);else if(/\\.(ts|tsx)$/.test(e.name))files.push(p)}})('src');
    let errors=[];for(const f of files){const out=ts.transpileModule(fs.readFileSync(f,'utf8'),{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext,jsx:ts.JsxEmit.ReactJSX},fileName:f,reportDiagnostics:true});for(const d of out.diagnostics||[]){if(d.category===ts.DiagnosticCategory.Error)errors.push(f+': '+ts.flattenDiagnosticMessageText(d.messageText,' '));}}
    if(errors.length){console.error(errors.join('\\n'));process.exit(1)}console.log(files.length);
  `;
  const count = execFileSync(process.execPath, ["-e", parser], { cwd: root, encoding: "utf8" }).trim();
  passed.push(`${count} TypeScript/TSX files parsed without syntax diagnostics`);
} catch (error) {
  failed.push(`TypeScript syntax parse failed: ${error?.stderr?.toString?.() || error}`);
}

for (const test of ["scripts/test-tv-status-engine.ts", "scripts/test-tvm-06-09.ts"]) {
  try {
    execFileSync(process.execPath, ["--experimental-strip-types", test], { cwd: root, stdio: "pipe" });
    passed.push(`${test} passed`);
  } catch (error) {
    failed.push(`${test} failed: ${error?.stderr?.toString?.() || error}`);
  }
}

const conflicts = [];
for (const absolute of walk(root)) {
  const path = relative(root, absolute).replaceAll("\\", "/");
  if (!/\.(?:ts|tsx|mjs|js|json|md|prisma|sql)$/.test(path)) continue;
  if (/^<<<<<<< |^=======\s*$|^>>>>>>> /m.test(readFileSync(absolute, "utf8"))) conflicts.push(path);
}
check(conflicts.length === 0, "No merge-conflict markers exist");
if (conflicts.length) failed.push(`Conflict markers found in: ${conflicts.join(", ")}`);

for (const message of passed) console.log(`PASS: ${message}`);
if (failed.length > 0) {
  for (const message of failed) console.error(`FAIL: ${message}`);
  console.error(`\nUser-facing integrity verification failed (${failed.length} failure(s)).`);
  process.exit(1);
}
console.log(`\nUser-facing integrity verification passed (${passed.length} checks).`);
