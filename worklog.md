# CineTrack - TV Time Clone Project Worklog

## Project Overview
Building a complete TV Time-like movie & TV show tracking application using:
- Next.js 16 with App Router
- TypeScript + Tailwind CSS 4 + shadcn/ui
- Prisma ORM (SQLite)
- TMDB API (free) proxied through Next.js API routes
- Zustand for state, TanStack Query for server state

## Architecture Decisions
- Single-page application pattern (only `/` route is user-visible)
- View switching managed via Zustand store (home, discover, search, detail, calendar, library, stats)
- TMDB API calls proxied through `/api/tmdb/*` routes (caching + no CORS issues)
- Local "user" concept (client-generated user ID stored in localStorage, synced to DB)
- Dark theme with rose/red accents (TV Time inspired)

---
Task ID: 1
Agent: main
Task: Set up Prisma database schema and push to DB

Work Log:
- Designed schema with User, WatchlistItem, WatchedMovie, WatchedEpisode, FollowingShow, Rating models
- Pushing schema to SQLite database

Stage Summary:
- Prisma schema with 6 models (User, WatchlistItem, WatchedMovie, WatchedEpisode, FollowingShow, Rating) pushed to SQLite
- All library API routes working: watchlist, watched-movies, watched-episodes (with bulk), following, ratings, stats, user
- TMDB API client + proxy route (/api/tmdb/[...path]) - all endpoints return 200
- Zustand store for navigation (view switching) with localStorage-persisted userId

---
Task ID: 2-11
Agent: main
Task: Build complete frontend (store, hooks, layout, views) and wire into page.tsx

Work Log:
- Created TanStack Query hooks (src/hooks/use-tmdb.ts) for all TMDB + library operations
- Created Zustand store (src/lib/store.ts) with view navigation, history, persisted userId
- Built layout components: Header (nav + search + theme toggle + avatar), Footer (sticky via flex-1 main)
- Built media components: MediaCard (with watchlist/watched/following status badges), MediaRow (horizontal scroll), RatingStars
- Built 8 views: HomeView (hero + 8 content rows + quick stats), DiscoverView (filters: genre/year/rating/sort + pagination), SearchView (debounced), MovieDetailView, TvDetailView (with episode tracker - the core TV Time feature), CalendarView (month grid + following shows), LibraryView (4 tabs), StatsView (charts: activity bar, library pie, rating distribution)
- Built AppShell with view switching + scroll-to-top on view change
- Configured dark cinema theme (rose/red accents) in globals.css with glass morphism, shimmer skeletons, custom scrollbar
- Fixed 2 lint errors (rules-of-hooks, set-state-in-effect)

Stage Summary:
- All 8 views functional and verified via agent-browser
- Episode tracking confirmed working: marked House of the Dragon S1E1 as watched, progress updated 0/10 -> 1/10
- Stats page correctly shows "1 episode watched" + watch time + activity chart
- Search returns 250 results for "batman" with movie cards
- Discover shows genre filters, sort options, pagination
- Library shows 4 tabs with empty states
- No runtime errors in dev.log
- Lint passes clean

---
Task ID: 12
Agent: main (cron review round 1)
Task: QA testing, fix bugs, and add new features (Continue Watching, Watch Providers, Profile/Settings, enhanced Calendar)

## Current Project Status Assessment
- Project was functional but had 1 critical runtime bug (missing imports) and 2 UX issues (Ratings tab & Stats Top Shows showing IDs instead of titles)
- All TMDB API routes returning 200, no server errors
- Lint was clean
- Dev server running on port 3000

## Work Log
- **QA via agent-browser**: Found `useWatchlist is not defined` runtime error in movie-detail-view.tsx (missing imports after a previous edit). Fixed by adding `useWatchlist, useWatchedMovies` to imports.
- **Enhanced Footer**: Added live mini-stats (movies/episodes count), gradient glow decorations, better icon (Clapperboard), removed dead imports (`Github`, non-existent `TMDB` icon).
- **Fixed Ratings tab UX**: Updated Prisma `Rating` model to include `title` and `posterPath` columns. Updated ratings API route to accept/save these fields. Updated `useRatingMutate` hook to pass title/poster. Updated movie & TV detail views to pass title/poster when rating. Rebuilt RatingsTab in library view to show poster + real title instead of "Movie #ID".
- **Fixed Stats Top Shows**: Created `TopShowRow` component that fetches show details via `useTvDetail` to display real poster + title instead of "Show #ID". Added gradient progress bar.
- **Added Continue Watching feature** (core TV Time feature): New `ContinueWatching` component on home page. For each followed show, fetches seasons 1-3 + watched episodes, finds the next unwatched episode, displays it in a horizontal scroll with poster, episode still, title, and "Mark watched" button. Shows "All caught up!" state when no unwatched episodes.
- **Enhanced Calendar**: Rebuilt CalendarView to fetch actual episode air dates from TMDB. Each calendar day now queries followed shows' recent seasons for episodes airing on that date, displaying them as clickable pills inside the day cell.
- **Added Watch Providers (Where to Watch)**: Added `watch/providers` to TMDB detail append_to_response. New `WatchProviders` component shows streaming/rent/buy options with provider logos, region badge, and JustWatch link. Added to both movie and TV detail pages.
- **Added Profile/Settings dialog**: New `ProfileDialog` component accessible via avatar button. Features: edit display name (with save), view user ID + member since date, library stats summary (4 metric cards), danger zone with AlertDialog confirmation to clear all library data. New `/api/library/clear` DELETE endpoint.
- **Added personalized greeting** on home page: "Good morning/afternoon/evening, {userName} 👋" with time-based logic.
- **Added content rating badges**: Movie detail shows MPAA rating (from release_dates), TV detail shows TV rating (from content_ratings) as highlighted badges.

## Verification Results
- ✅ Lint passes clean
- ✅ No runtime errors in dev.log (all routes 200)
- ✅ Movie detail page loads without errors (was crashing before)
- ✅ Ratings tab shows real title "Obsession" + poster (was "Movie #1339713")
- ✅ Stats Top Shows shows "House of the Dragon" + poster (was "Show #2022")
- ✅ Continue Watching shows next episode (House of the Dragon S1E2 "The Rogue Prince") with Mark watched button
- ✅ Profile dialog opens, name editing works (changed to "Test User", avatar updated to "TE")
- ✅ Watch Providers section shows on detail pages with rent/buy options
- ✅ Greeting displays "Good morning, Test User 👋"
- ✅ Content rating badges appear (TV-MA, R, etc.)

## Unresolved Issues / Risks
- Calendar makes many parallel API calls (one per followed show per day) which could be slow with many followed shows. Capped at 12 shows. Could optimize with a dedicated "upcoming episodes" TMDB endpoint in the future.
- Continue Watching fetches 3 seasons per followed show in parallel — works well for typical use but could be optimized.
- No person/cast detail view yet (clicking cast members doesn't navigate) — low priority.

## Priority Recommendations for Next Phase
1. Add person/cast detail view (click cast member → see their filmography)
2. Add "Recently watched" quick-access on home
3. Add keyboard shortcuts (e.g., "/" to focus search, Esc to go back)
4. Add export/import library data (JSON backup)
5. Optimize Calendar API calls with batching
6. Add genre-based recommendations on home

---
Task ID: 13
Agent: main (cron review round 2)
Task: QA testing, fix calendar bug, add Person detail view, keyboard shortcuts, export/import, Recently Watched

## Current Project Status Assessment
- Project was stable after round 1 with all features working
- Lint was clean, no server errors
- Dev server running on port 3000

## Work Log
- **QA via agent-browser**: Found critical runtime error `today is not defined` in calendar-view.tsx line 156. The `CalendarGrid` component used `today` variable but it was never defined in scope. Fixed by adding `const today = new Date(); today.setHours(0,0,0,0);` at the top of CalendarGrid.
- **Added Person/Cast detail view**: New `PersonDetailView` component showing actor's profile photo, name, department, birthday/age, birthplace, biography, stats (movie/TV credits + popularity), "Known For" carousel, and full filmography tabs (Movies/TV). Added `person-detail` view + `goPerson` action + `personId` to Zustand store. Added `usePersonDetail` hook. Made cast cards clickable in both movie-detail-view and tv-detail-view (with hover effects).
- **Added keyboard shortcuts**: New `KeyboardShortcuts` component (invisible, global keydown listener). Shortcuts: `/` or `s` to focus search, `Esc` to go back/blur, `g h` home, `g d` discover, `g s` stats, `g l` library, `g c` calendar. Respects typing context (doesn't trigger when in input fields, except Esc).
- **Added export/import library data**: New `/api/library/export` GET endpoint returns all library data as JSON. New `/api/library/import` POST endpoint merges imported data (upserts). Added Backup & Restore section to ProfileDialog with Export (downloads JSON file) and Import (file picker) buttons.
- **Added Recently Watched section on home**: New `RecentlyWatched` component shows recently watched movies (from watchedMovies library data) with posters, green checkmark badges, and watch dates. Appears between Continue Watching and Trending Now.

## Verification Results
- ✅ Lint passes clean
- ✅ No runtime errors in dev.log
- ✅ Calendar view loads without "today is not defined" error (was crashing before)
- ✅ Person detail view loads with full biography, stats, Known For, filmography
- ✅ Cast cards are clickable and navigate to person detail (tested Michael Johnston from Obsession)
- ✅ Keyboard shortcuts work: `g d` navigated to Discover, `/` focused search input
- ✅ Profile dialog shows Backup & Restore section with Export/Import buttons
- ✅ Recently Watched section appears on home after marking movie as watched (shows Obsession poster with green checkmark)
- ✅ VLM confirmed visual quality of all new features

## Unresolved Issues / Risks
- Person detail view makes multiple API calls for filmography (could be optimized)
- Calendar still makes parallel calls per followed show (capped at 12) - acceptable for typical use
- No keyboard shortcut hint UI yet (users may not discover shortcuts)

## Priority Recommendations for Next Phase
1. Add keyboard shortcuts help overlay (press `?` to show)
2. Add genre-based recommendations on home (based on most-watched genres)
3. Add "watch progress" percentage indicator on followed show cards
4. Optimize calendar with a batch endpoint or TMDB's TV schedule endpoint
5. Add dark/light theme persistence improvements
6. Add social features: share watchlist link (read-only public view)

---
Task ID: 14
Agent: main (cron review round 3)
Task: QA testing, add keyboard shortcuts help overlay, watch progress cards, genre recommendations, improved empty states

## Current Project Status Assessment
- Project was stable after round 2 with all features working
- Lint was clean, no server errors
- Dev server running on port 3000
- All previously added features (Person detail, keyboard shortcuts, export/import, Recently Watched, Continue Watching, Watch Providers, Profile dialog) verified working

## Work Log
- **QA via agent-browser**: Tested home, discover (with Action genre filter + pagination), movie detail (Shawshank Redemption), stats views. All working correctly, no errors found.
- **Added keyboard shortcuts help overlay**: New `ShortcutsHelpDialog` component (exported from keyboard-shortcuts.tsx) shows all shortcuts in a beautiful dialog with grouped sections (Navigation, Search & Back, Help). Each shortcut displays key combinations in styled `<kbd>` elements. Opens via `?` key or a new keyboard icon button in the header. Closes with Esc.
- **Added watch progress on followed show cards**: New `FollowedShowCard` component in home view's FollowingSection. Fetches show detail (total episodes) + watched episodes, computes progress percentage, displays a progress bar overlay at the bottom of each poster with "X/Y" count and "Z%" label. Progress updates live when episodes are marked watched.
- **Re-enabled FollowingSection on home**: The "Your Shows" section with progress cards now renders on home between Continue Watching and Recently Watched (was previously defined but not rendered).
- **Added genre-based recommendations**: New `GenreRecommendations` component on home. Rotates through TMDB genres daily to show 3 varied recommendation rows: "Top {Genre} Movies" (sorted by rating, 7+), "Popular {Genre} Shows", and "Trending {Genre} Movies". Always visible for discovery.
- **Improved empty states**: Enhanced `EmptyState` component in library view with gradient icon backgrounds (primary/20 to primary/5), larger rounded icons, gradient card background, and CTA buttons ("Discover content", "Browse movies", "Discover shows", "Find something to rate") that navigate to the discover view. Updated all 4 library tab empty states (watchlist, watched movies, following, ratings).

## Verification Results
- ✅ Lint passes clean
- ✅ No runtime errors in dev.log
- ✅ Keyboard shortcuts help dialog opens via `?` key and header button (VLM confirmed kbd elements)
- ✅ Watch progress shows on followed show cards: "0/26 0%" → "1/26 4%" after marking episode watched
- ✅ Genre recommendations show 3 rows: "Top War Movies", "Popular Talk Shows", "Trending Adventure Movies"
- ✅ Empty states have gradient icons + CTA buttons (VLM confirmed "Discover content" button)
- ✅ All previous features still working (calendar, person detail, search, discover filters, pagination)

## Unresolved Issues / Risks
- Genre recommendations make 3 parallel discover API calls on home load (acceptable, cached)
- Watch progress cards fetch show detail + watched episodes per followed show (capped by Continue Watching's 12-show limit in practice)
- No keyboard shortcut hint badge on the keyboard icon button (users may not notice it)

## Priority Recommendations for Next Phase
1. Add a "shortcuts" tooltip or badge on the keyboard icon to improve discoverability
2. Add watch progress to the Library > Following tab cards (currently only on home)
3. Add a "Watch next" quick-action that jumps directly to the next unwatched episode
4. Add theme toggle animation/transition
5. Add lazy loading for images (performance optimization)
6. Add a "random pick" / surprise me button on discover

---
Task ID: 15
Agent: main (cron review round 4)
Task: QA testing, add Following tab watch progress, Surprise Me button, Watch Next featured card, keyboard tooltip

## Current Project Status Assessment
- Project was stable after round 3 with all features working
- Lint was clean, no server errors
- Dev server running on port 3000
- All previously added features (keyboard shortcuts help, watch progress on home, genre recommendations, improved empty states, person detail, export/import) verified working

## Work Log
- **QA via agent-browser**: Tested home, discover (with filters + pagination), TV detail (House of the Dragon with episode tracking), stats views. All working correctly, no errors found.
- **Added watch progress to Library > Following tab**: Created reusable `FollowingCard` component with framer-motion entrance animation. Shows: Following badge, season count, status, watch progress bar (gradient from primary to purple) with "X / Y episodes" and "Z%" label, Track and Unfollow buttons. Fetches show detail + watched episodes to compute progress.
- **Added "Surprise Me" button on Discover**: New dice icon button next to the Movies/TV tabs. Clicking it randomizes the sort order (from 4 options: popularity, vote_average, release_date, revenue) and jumps to a random page (1-20), showing a toast "🎲 Surprise! Here are some random picks". Styled with primary border and hover effect.
- **Added "Watch Next" featured card**: The first card in Continue Watching is now larger (320px/380px vs 280px/320px), has a ring-2 primary glow with shadow, and displays a "WATCH NEXT" badge in the bottom-right corner of the episode still. This highlights the single most important next episode to watch.
- **Added tooltip to keyboard shortcuts button**: Wrapped the keyboard icon button in a TooltipProvider/Tooltip showing "Keyboard shortcuts ?" with a styled kbd element. Added a pulsing primary dot badge on the button to improve discoverability.

## Verification Results
- ✅ Lint passes clean
- ✅ No runtime errors in dev.log
- ✅ Library > Following tab shows watch progress: "0 / 26 episodes" + "0%" with gradient progress bar (VLM confirmed all 5 elements: title, Following badge, season/status, progress, buttons)
- ✅ Surprise Me button works: changed sort to "Highest Revenue" and jumped to random page
- ✅ Watch Next featured card shows on home Continue Watching: larger size, ring glow, "WATCH NEXT" badge (VLM confirmed)
- ✅ Keyboard shortcuts button has tooltip with "?" hint and pulsing dot badge
- ✅ All previous features still working

## Unresolved Issues / Risks
- Following card makes 2 API calls per card (show detail + watched episodes) - acceptable for typical library sizes
- Surprise Me only randomizes within current media type (Movies or TV) - could add cross-type randomization
- Watch Next badge only appears on the first Continue Watching card

## Priority Recommendations for Next Phase
1. Add "Watch Next" CTA in the hero/greeting area for even faster access
2. Add sorting options to Library tabs (e.g., sort watchlist by date added, sort watched by date watched)
3. Add a "continue watching" badge/count on the Home nav button
4. Add batch "mark all watched" for a season from the home Continue Watching
5. Add image lazy-loading with blur-up placeholder effect
6. Add a "recently added to watchlist" notification/toast

---
Task ID: 16
Agent: main (cron review round 5)
Task: QA testing, add Library sorting, Watch Next CTA in greeting, NEW badge, blur-up images

## Current Project Status Assessment
- Project was stable after round 4 with all features working
- Lint was clean, no server errors
- Dev server running on port 3000
- All previously added features (Following tab progress, Surprise Me, Watch Next card, keyboard tooltip) verified working

## Work Log
- **QA via agent-browser**: Tested home, search (inception → 12 results), library views. All working correctly. Found initial empty-page timing issue (resolved by re-opening browser).
- **Added sorting to Library Watchlist tab**: New `SortControl` with 4 options: Most Recent (by addedAt), Top Rated (by voteAverage), A-Z (by title), Newest First (by releaseDate). Shows item count. Items sorted via `useMemo`. Watchlist cards refactored into reusable `WatchlistCard` component with framer-motion entrance animation.
- **Added sorting to Library Watched Movies tab**: 3 sort options: Most Recent (by watchedAt), A-Z (by title), Longest (by runtime). Shows movie count. Cards wrapped in motion.div with hover shadow effects.
- **Added "Watch Next" CTA in greeting area**: New `WatchNextCTA` component - a gradient (primary→purple) pill button with play icon that appears in the home greeting area when user has followed shows. Shows "WATCH NEXT" label + first followed show title. Hover scale effect. Clicking navigates to the show detail page.
- **Added "NEW" badge on recently added watchlist items**: Watchlist cards now show a green "NEW" badge if the item was added within the last 24 hours (computed via `Date.now() - addedAt < 24h`).
- **Added blur-up image loading**: MediaCard now loads a tiny w92 image as a blurred background (blur-xl scale-110) behind the full w342 image. This creates a progressive blur-up effect where a blurred version appears instantly while the full image loads.
- **Polished card hover effects**: All library cards (watchlist, watched movies, following) now have framer-motion entrance animations, hover shadow-lg with primary/5 glow, and image scale-105 on hover.

## Verification Results
- ✅ Lint passes clean
- ✅ No runtime errors in dev.log
- ✅ Library Watchlist shows sort control with 4 options + "1 items" count (VLM confirmed)
- ✅ Watch Next CTA appears in greeting area: gradient button "WATCH NEXT House of the Dragon" (VLM confirmed)
- ✅ NEW badge appears on recently added watchlist item (< 24h)
- ✅ Blur-up image loading works (tiny image as blurred background)
- ✅ All previous features still working

## Unresolved Issues / Risks
- Blur-up adds an extra small image request per card (w92 is tiny, ~2-5KB, acceptable)
- SortControl component is defined but inlined in WatchedMoviesTab (minor code duplication)
- Watch Next CTA only shows the first followed show (could rotate or show count of unwatched episodes)

## Priority Recommendations for Next Phase
1. Add sort to Following tab (by progress %, by name, by followed date)
2. Add sort to Ratings tab (by rating value, by date, by title)
3. Add a "filter by type" (movie/TV) toggle to watchlist tab
4. Add skeleton loading states for Continue Watching cards
5. Add a "back to top" floating button for long pages
6. Add toast notifications for library actions (added/removed) with undo

---
Task ID: 17
Agent: main (deployment round)
Task: Deploy to GitHub and Vercel

## Current Project Status Assessment
- Project was stable and feature-complete locally
- Needed deployment to GitHub (Hussam9329/TvTime) and Vercel

## Work Log
- **Pushed to GitHub**: Repository https://github.com/Hussam9329/TvTime created and code pushed successfully
- **Configured for Vercel**: 
  - Removed `output: "standalone"` from next.config.ts
  - Updated build script to `prisma generate && next build`
  - Updated start script to `next start`
  - Improved db.ts logging for production
- **Initial Vercel deployment**: Site deployed to https://tvtime-iota.vercel.app but library API failed with PrismaClientInitializationError (SQLite doesn't work on Vercel serverless - read-only filesystem)
- **Switched library to localStorage**: Created comprehensive `libStorage` module (src/lib/local-storage.ts) that stores all library data (watchlist, watched movies/episodes, following, ratings, stats, export/import) in browser localStorage. Updated all hooks in use-tmdb.ts to use libStorage instead of API calls. Updated ProfileDialog to use libStorage for export/import/clear.
- **Final Vercel deployment**: Successfully deployed with localStorage backend. Site fully functional.

## Verification Results
- ✅ GitHub repo: https://github.com/Hussam9329/TvTime (code pushed)
- ✅ Vercel deployment: https://tvtime-iota.vercel.app (live)
- ✅ Home page loads (200), TMDB API works (200)
- ✅ Library features work via localStorage: added movie to watchlist, shows "1 items" in Library
- ✅ Stats page works with localStorage data
- ✅ All views functional on production deployment

## Architecture Change
- Library data moved from Prisma/SQLite (server-side) to localStorage (client-side)
- This makes the app work on any serverless platform without database configuration
- TMDB API calls still go through Next.js API routes (server-side proxy)
- API routes for library still exist but are no longer used (can be removed in future cleanup)

---
Task ID: 18
Agent: main (Neon PostgreSQL migration)
Task: Switch from localStorage to Neon PostgreSQL, import 3496 media items from backup

## Current Project Status Assessment
- User provided Neon PostgreSQL connection string
- User provided backup JSON file (hussamvision-backup-2026-07-07.json) with 3496 media items
- Previous deployment used localStorage (client-side only)

## Work Log
- **Created Media model in Prisma schema**: Unified model matching backup structure (title, type, poster, rating, overview, genres, watched, userRating, status, etc.) with PostgreSQL provider
- **Pushed schema to Neon**: `prisma db push` created the Media table in Neon PostgreSQL (removed `channel_binding=require` from connection string for compatibility)
- **Wrote import script** (scripts/import-backup.ts): Reads backup JSON and batch-inserts all items using `createMany` with `skipDuplicates`
- **Imported all 3496 items**: Successfully imported 3315 movies, 143 TV series, 23 books, 15 games (with 2197 ratings, 12 watched, 50 planned)
- **Created Media API routes**: 
  - `/api/media` - GET with filters (type, status, watched, rated, search), sorting (addedAt, userRating, title, year), and pagination
  - `/api/media/stats` - GET with aggregate counts, rating distribution, type distribution, top rated, recently added
- **Added useMedia and useMediaStats hooks** in use-tmdb.ts
- **Created MediaView component**: Full-featured collection browser with type tabs (All/Movies/TV/Books/Games), search, sort, rated-only filter, pagination, and media cards with type badges, user ratings, watched/planned status indicators
- **Added "My Media" to navigation**: New nav button with Database icon, added to header nav items
- **Fixed undefined params bug**: Media API was receiving "undefined" as string params, causing empty results. Fixed by filtering out undefined/empty values in both the hook and API route
- **Configured Vercel env**: Removed old SQLite DATABASE_URL, added Neon PostgreSQL URL
- **Deployed to Vercel**: Successfully deployed with Neon backend

## Verification Results
- ✅ Lint passes clean
- ✅ Neon PostgreSQL database has 3496 items (verified via Prisma count)
- ✅ Media API returns items: https://tvtime-iota.vercel.app/api/media?limit=5
- ✅ Media Stats API returns correct counts: total=3496, movies=3315, series=143, books=23, games=15
- ✅ "My Media" view on Vercel shows "3496 items from your Neon database"
- ✅ Grid displays 60 items per page with posters, titles, type badges, user ratings
- ✅ VLM confirmed: total count, filter tabs, media card grid all working
- ✅ All data is now server-side in Neon PostgreSQL (not localStorage)

## Architecture Change
- Library data now stored in Neon PostgreSQL (server-side, persistent)
- TMDB browsing features still use TMDB API via proxy routes
- The old localStorage-based library hooks still exist for the app's tracking features (watchlist, following, etc.)
- New "My Media" view provides access to the full imported collection from Neon
- Data persists across devices/sessions since it's in the cloud database

---
Task ID: 19
Agent: main (unify Home+Library)
Task: Fix disconnection between Home and Library - all tracking now writes to Neon

## Problem
- Home/Discover used localStorage for tracking (watchlist, watched, following, ratings)
- Library used Neon PostgreSQL
- Adding a movie to watchlist from Home didn't appear in Library
- Stats were inaccurate (counting from two different sources)

## Solution
- Added `tmdbId` column to Media model for linking TMDB items to DB records
- Created `/api/media/find-or-create` API endpoint: finds existing Media by tmdbId or title, creates new if not found
- Rewrote all library hooks in use-tmdb.ts to write directly to Neon:
  - `useWatchlistToggle` → find-or-create + set status="planned"
  - `useWatchedMovieToggle` → find-or-create + set watched=true, status="watched"
  - `useFollowingToggle` → find-or-create (type="series") + set status="planned"
  - `useRatingMutate` → find-or-create + set userRating + watched=true
- All reads (useWatchlist, useWatchedMovies, useFollowing, useRatings, useStats) now query Neon API
- Episode tracking stays in localStorage (no episode model in DB)
- Updated stats API to return Home-compatible field aliases (watchlist=planned, watchedMovies=rated, etc.)

## Verification
- ✅ Added "Obsession" to watchlist from Home → appears in Library Watchlist Movies (search finds it: "Showing 1 of 1 items")
- ✅ Home stats now show: Watchlist=50, Movies watched=2196, Following=21 (all from Neon)
- ✅ All data unified in single Neon PostgreSQL database

---
Task ID: FOUNDATION-PATCH-HOOKS
Agent: foundation-patch-hooks
Task: Wire all client hooks, components, and library API routes to the new server-backed library (Media + WatchedEpisode tables in PostgreSQL) via the new client-user helpers

## Problem
- The foundation patch added `client-user.ts` (with `withUserId`, `userHeaders`, `getClientUserId`) and `safe-image.tsx`, but the hooks/components still talked to localStorage for episode tracking and to the legacy library endpoints for stats/export/import/clear.
- `continue-watching.tsx`, `calendar-view.tsx`, and `tv-tracking-view.tsx` were each fetching only seasons 1-4 per show, missing next-episode detection for shows with later seasons.
- `safe-image.tsx` had a `react-hooks/set-state-in-effect` lint error from the foundation patch.
- `src/lib/db.ts` had been broken by the foundation patch (self-import + missing `PrismaClient` import), which would prevent every API route from instantiating Prisma.

## Solution / Work Log

### `src/hooks/use-tmdb.ts` (full rewrite of library section)
- Imported `getClientUserId, userHeaders, withUserId` from `@/lib/client-user`.
- Removed `libStorage` import; replaced with `// Episode tracking is now server-backed via API`.
- Added `mediaToLibraryCompat(m)` helper after `findOrCreateMedia` to translate Media rows into the legacy library-item shape (`mediaType`, `posterPath`, `releaseDate`, `voteAverage`, `followedAt`, `watchedAt`, `value`).
- All `/api/media/...` calls now go through `withUserId(new URL(...))` and carry `...userHeaders()`.
- `useWatchlist` → `status: "planned"` filter; `useWatchedMovies` → `watched: "true"`; `useFollowing` → `status: "planned"` (no more `isAnime`/`rated` combo); all map items through `mediaToLibraryCompat`.
- `useTrackedShows`, `useRatings` use `withUserId` + `userHeaders` + `mediaToLibraryCompat`.
- `useWatchlistToggle`, `useWatchedMovieToggle`, `useFollowingToggle`, `useRatingMutate`, `useMediaUpdate` — every PATCH/POST now uses `withUserId` for the URL and adds `...userHeaders()` to the headers.
- `useRatingMutate` now converts 1-10 input to 0-100 with `userRating: args.value == null ? null : args.value * 10`.
- `useWatchedEpisodes` rewritten to fetch `/api/library/watched-episodes` (with `userId` in the query key).
- `useEpisodeToggle` (POST single / DELETE) and `useBulkEpisodeToggle` (POST `{ showId, episodes }`) now hit the API with `userHeaders`, invalidating `["lib", "watched-episodes"]` and `["lib", "stats"]`.
- `useStats` now hits `/api/library/stats` (was `/api/media/stats`) so it includes watched-episode data.
- Added `useShowProgress(showId)` — composes `useTvDetail` + `useWatchedEpisodes` + a `useQuery` that fetches **all** regular seasons (not just 1-4) via `tmdbGet<SeasonDetail>(tv/${id}/season/${N})`. Returns a unified shape (`showDetail, watchedSet, watchedItems, totalEpisodes, watchedCount, nextEp, allEpisodes, seasons, lastWatchedDate, daysSinceLastWatch, nextEpAirDate, isUpcoming, isLoading, isError`).
- Extended `MediaStats.counts` with optional fields (`watchlistMovies`, `watchedMovies`, `watchlistShows`, `watchedShows`, `watchlistAnime`, `watchedAnime`, `watchedEpisodes`, etc.) so `library-view.tsx` can read them.
- Added `isAnime` to `MediaItemDB`.

### `src/components/media/continue-watching.tsx`
- Replaced `useTvDetail` + `useWatchedEpisodes` + 4× `useSeasonDetail` with `const data = useShowProgress(showId);`.
- Destructured `watchedSet, watchedCount, totalEpisodes, nextEp, seasons, isLoading`.
- `markAllSeason` now calls `bulkToggle.mutate({ showId, episodes: unwatched })` (was a forEach of single `episodeToggle.mutate` calls).

### `src/components/media/media-card.tsx`
- Imported `SafeImage` and replaced both `<img>` tags (blur-up placeholder + main poster) with `<SafeImage>`.

### `src/components/profile/profile-dialog.tsx`
- Replaced `libStorage` import with `userHeaders, withUserId` from `@/lib/client-user`.
- `onClearData` → DELETE `withUserId(/api/library/clear)` with `userHeaders()`; invalidates both `["lib"]` and `["media"]`.
- `onExport` → GET `withUserId(/api/library/export)` with `userHeaders()`, parses JSON, downloads as blob.
- `onImport` → POST `withUserId(/api/library/import)` with `Content-Type` + `userHeaders()`, reads `imported` counts, invalidates both query families.

### `src/components/views/calendar-view.tsx`
- Swapped `useTvDetail` for `useShowProgress`.
- `followedToShow` cap raised from 12 to 50; per-day show cap raised from 8 to 20.
- `DayEpisode` now uses `useShowProgress(showId)` and finds the matching episode from `progress.allEpisodes`.

### `src/components/views/tv-tracking-view.tsx`
- Imports: removed `useTvDetail, useWatchedEpisodes, useSeasonDetail`, added `useShowProgress`.
- `useShowTrackingData` is now `return useShowProgress(showId);`.
- `ShowProgressCard` rewritten to read from `useShowProgress` (`progress.totalEpisodes`, `progress.watchedCount`, `progress.showDetail`, `progress.isLoading`), with a local `progressPct` for the bar/label.

### `src/components/views/library-view.tsx`
- Imported `SafeImage`; poster `<img>` → `<SafeImage>`.
- `TAB_CONFIG` field `rated: boolean` renamed to `isWatched: boolean`.
- `useMedia` query now sends `status: "planned"` for watchlist tabs and `watched: "true"` for watched tabs.
- Mini stats read `counts?.watchlistMovies`, `watchedMovies`, `watchlistShows`, `watchedShows`, `watchlistAnime`, `watchedAnime` (with `?? 0` fallbacks).

### `src/components/views/media-view.tsx`
- Imported `SafeImage`; poster `<img>` → `<SafeImage>`.

### `src/components/media/safe-image.tsx` (lint fix)
- Rewrote to use the React "adjust state when prop changes" pattern instead of `useEffect` + `setState`. Tracks `prevSrc` + `usedFallback` in state and computes `currentSrc` from `normalizedSrc`, `retries`, and `usedFallback` on each render. Resolves the `react-hooks/set-state-in-effect` error left by the foundation patch.

### Library API routes
- **`/api/library/stats`** — rewritten to combine Media + WatchedEpisode tables. Returns the full counts shape needed by Home, Library, Stats, and TV Tracking views (`total, movies, series, books, games, rated, watched, planned, watchlist, watchlistMovies, watchlistShows, watchlistAnime, watchedMovies, watchedShows, watchedAnime, watchedEpisodes, showsWatched, following, ratings`), plus `watchTime`, `episodesByShow`, `episodesByMonth`, `ratingDist`, `avgRating`, `user`.
- **`/api/library/export`** — exports `library.media` (normalized) + `library.watchedEpisodes` (version 2 format).
- **`/api/library/import`** — accepts both v2 (`library.media` + `library.watchedEpisodes`) and v1 (legacy `watchlist/watchedMovies/following/ratings`). Legacy sections are converted into Media rows on import (watchlist → `status: "planned"`, watchedMovies → `watched: true`, ratings → `userRating: value * 10`).
- **`/api/library/clear`** — DELETE now wipes Media + WatchedEpisode + the legacy tables (WatchlistItem, WatchedMovie, FollowingShow, Rating). The User record is preserved.
- **`/api/library/watched-episodes`** — already used `parseUserId(req)` + `getOrCreateUser(userId)`, so it already works with the new schema. No changes needed.

### `src/lib/db.ts` (incidental fix)
- The previous foundation patch had broken this file by replacing `import { PrismaClient } from '@prisma/client'` with `import { db } from '@/lib/db'` (self-import) and leaving `PrismaClient` unbound. Restored the correct import so Prisma actually instantiates. This unblocks every API route that uses `db`.

## Verification
- `bun run lint` — passes clean (exit 0).
- `bunx tsc --noEmit --skipLibCheck` — only 2 remaining errors, both pre-existing in `src/components/views/movie-detail-view.tsx` (lines 81/95: `m.title` is `string | undefined` per the TMDB type, passed to a hook that wants `string`). These were not introduced by this patch (file unchanged from HEAD) and ESLint does not flag them.
- No more `libStorage` references in `src/hooks/use-tmdb.ts` or `src/components/profile/profile-dialog.tsx`. The only remaining `libStorage` is the export inside `src/lib/local-storage.ts` (kept for any future legacy consumers).

## Notes for downstream agents
- `useShowProgress` is the canonical way to get show progress now — it composes TMDB + watched-episodes API and returns everything the old `useShowTrackingData` returned, plus `isError`. Continue-watching, calendar, and TV-tracking views are already migrated.
- `mediaToLibraryCompat` is intentionally permissive (falls back across field names: `posterPath ?? poster`, `releaseDate ?? year`, etc.) so it can absorb both raw Media rows and any legacy localStorage-shaped data.
- The library stats endpoint requires both `Media` and `WatchedEpisode` tables in PostgreSQL — both are present in the current Prisma schema.
- All client → API calls now carry the user id both as a `userId` query param (via `withUserId`) and as an `x-user-id` header (via `userHeaders`). The server accepts either.

---
Task ID: FOUNDATION-PATCH-FINAL
Agent: main
Task: Apply foundation patch - user-scoped Media, episode tracking via API, useShowProgress, SafeImage, security

## Current Project Status
- Foundation patch fully applied
- ALL DATA PRESERVED: 4035 media items (3315 movies + 682 series)
- PostgreSQL kept (NOT switched to SQLite) to preserve data
- Episode tracking moved from localStorage to API/Database
- useShowProgress fetches ALL seasons (not just first 4)
- SafeImage component prevents broken images
- Security headers added, ignoreBuildErrors removed

## Changes Applied
1. **Prisma schema**: Added User, WatchlistItem, WatchedMovie, WatchedEpisode, FollowingShow, Rating models. Added userId to Media with default "cinetrack_default". Kept PostgreSQL with String[] arrays.
2. **New files**: user-id.ts, client-user.ts, media-normalize.ts, safe-image.tsx
3. **Updated**: next.config.ts (security headers, no ignoreBuildErrors), db.ts (reduced logging), user.ts (sanitizeUserId), tsconfig.json (exclude scripts/skills)
4. **API routes**: All media/* and library/* routes now user-scoped with error handling
5. **Hooks**: Episode tracking via API (not localStorage), useShowProgress for all seasons, userHeaders everywhere, stats from /api/library/stats
6. **Components**: SafeImage in media-card/library/media views, useShowProgress in continue-watching/calendar/tv-tracking, profile dialog uses API for export/import/clear
7. **Stats**: Watched = rated (userRating != null), Watchlist = unrated (userRating = null)

## Verification
- ✅ Lint passes clean
- ✅ TypeScript: 0 errors in src/
- ✅ Data: 4035 items preserved (3315 movies, 682 series, 456 watched, 2641 rated)
- ✅ Home stats: Watchlist 1356, Movies watched 2195, TV Shows rated 446, Following 236
- ✅ Library Watched Movies: 2195 items
- ✅ Library Watched TV: 403 items
- ✅ Library Watched Anime: 5 items
- ✅ TV Tracking: All 6 tabs working (Watchlist, Finished, Finished Anime, Upcoming, Haven't Watched, Haven't Started)
- ✅ Continue Watching: Uses useShowProgress (all seasons)

---
Task ID: tv-status-rewrite
Agent: main
Task: Implement proper TV show status tracking — Finished (Ended) vs Up To Date (ongoing), with 0-100 rating prompt on completion

Work Log:
- Rewrote `autoUpdateShowStatus` in `/api/library/watched-episodes/route.ts`:
  - Fetches fresh TMDB show status + total episodes
  - If all episodes watched AND show is Ended/Canceled → status = "finished"
  - If all episodes watched AND show is ongoing (Returning/In Production) → status = "uptodate"
  - Removed the old behavior of auto-setting userRating=75 (now the user is prompted)
  - Returns `CompletionInfo` (newStatus, isEnded, needsRating) so the client can open the RatingDialog
- Updated `/api/media/route.ts` GET to support `status=finished` matching both "finished" and legacy "watched" (backward compat for shows already in the DB)
- Updated `use-tmdb.ts`:
  - `useRatingMutate` now accepts 0-100 directly (removed the *10 multiplication)
  - `useEpisodeToggle` and `useBulkEpisodeToggle` now return the server's `completion` info and invalidate `["media"]` queries so the TV Tracking view refetches
  - Added `EpisodeCompletion` type export
  - All episode-toggle requests now include `withUserId` + `userHeaders`
- Updated `tv-tracking-view.tsx`:
  - Added new "Up To Date" tab between Watchlist and Finished
  - FinishedTab now filters by `status=finished` (was `watched=true`)
  - New `UpToDateTab` + `UpToDateShowCard` with cyan theme, "Waiting for show to end — rate it then" hint when unrated
  - `FinishedShowCard` now shows prominent "X/100" rating with progress bar, or a "Rate this show" button if unrated
  - `NextEpisodeCard` now uses `mutateAsync` and propagates `completion` to parent via `onCompletion` callback
  - Parent `TvTrackingView` opens `RatingDialog` when `completion.newStatus === "finished" && completion.needsRating`
- Updated `tv-detail-view.tsx`:
  - Replaced `RatingStars` (0-10) with big "X/100" display + "Rate out of 100" button → opens `RatingDialog`
  - Shows "Finished" (emerald Trophy) or "Up To Date" (cyan Zap) badge based on TMDB status + watched state
  - Auto-promotes "uptodate"/"watched" shows to "finished" when TMDB reports the show as Ended
  - Auto-opens RatingDialog when opening an Ended, fully-watched, unrated show (uses "adjust state during render" pattern)
  - `SeasonEpisodes` now uses `mutateAsync` and propagates `completion` to parent
- Updated `movie-detail-view.tsx`:
  - Replaced `RatingStars` with `RatingDialog` (0-100) for consistency with TV shows
  - Shows big "X/100" display with colored rating and progress bar
- All TypeScript checks pass (`tsc --noEmit`)
- All ESLint checks pass
- Production build succeeds (`next build`)

Stage Summary:
- TV shows now correctly distinguish:
  - **Finished**: Ended/Canceled show + all episodes watched → appears in "Finished" tab, rating prompt appears
  - **Up To Date**: Ongoing show + all currently-aired episodes watched → appears in "Up To Date" tab, no rating prompt (waits for show to end)
  - **Watchlist (planned)**: Show is followed but not fully watched yet
- Ratings are now 0-100 everywhere (TV detail, movie detail, library cards, TV tracking cards)
- The RatingDialog auto-opens when:
  1. User marks the last episode of an Ended show as watched (via `completion.needsRating` from server)
  2. User opens the detail page of an Ended, fully-watched, unrated show
- Backward compatible: existing shows with `status="watched"` are treated as "finished" in queries

---
Task ID: recently-watched-poster-fix
Agent: main
Task: Apply PATCH for Recently Watched poster bug — TMDB-backed movies were matched by title, causing wrong posters

Work Log:
- Read patch contents (DIFF + PATCH_NOTES + AGENT_PROMPT) from uploaded zip
- Manually merged the patch with my earlier TV-status-rewrite changes (no git conflicts since the patch's hunks for use-tmdb.ts and movie-detail-view.tsx are in different code regions)
- Applied `src/app/api/media/find-or-create/route.ts`:
  - Removed title fallback for TMDB-backed media when tmdbId is present (root cause of wrong posters)
  - Kept title fallback only for manually-created records without tmdbId
  - When a record is matched by the same tmdbId, incoming TMDB metadata is now authoritative — overwrites stale/wrong poster/title/year/overview/rating/runtime/genres instead of first-write-wins
- Applied `src/components/views/home-view.tsx`:
  - Replaced inline Recently Watched button markup with new `RecentlyWatchedCard` component
  - Card uses `useMovieDetail(tmdbId)` to fetch live TMDB detail and prefers `detail.poster_path` over the stored poster
  - Stored poster is used only as a fallback while loading or offline
  - Uses `SafeImage` component (handles retry + placeholder) instead of bare `<img>`
- Applied `src/components/views/movie-detail-view.tsx`:
  - `onWatched` now sends `releaseDate`, `voteAverage`, `overview` along with the existing fields, so find-or-create receives full metadata to repair stale rows
- Applied `src/hooks/use-tmdb.ts`:
  - `useWatchedMovies` query now sorts by `watchedAt desc` so the Recently Watched row reflects recency (matching the section name)
- Created `scripts/repair-media-posters.mjs` (the patch's repair script — kept for `npm run repair:posters` in local/dev with a real DATABASE_URL)
- Added `repair:posters` script to `package.json`
- Created `src/app/api/admin/repair-posters/route.ts` — a temporary admin endpoint that runs the same repair logic on Vercel's runtime (where the encrypted Neon DATABASE_URL is resolvable), since the local CLI can't decrypt Vercel secrets. Endpoint is idempotent and safe to call multiple times; optional `ADMIN_REPAIR_SECRET` query-param protection.
- All TypeScript checks pass (`tsc --noEmit`)
- All ESLint checks pass
- Production build succeeds (`next build`) — `/api/admin/repair-posters` registered as a serverless route

Stage Summary:
- Recently Watched row now always uses TMDB id as the source of truth for posters; stored poster is only a fallback
- Existing corrupted rows will be healed in two ways:
  1. **Lazily** as users open movies (find-or-create now overwrites wrong posters with authoritative TMDB data)
  2. **Bulk** via one POST-deploy call to `/api/admin/repair-posters` (this run will happen right after the Vercel deploy below)
- The bug class (TMDB-backed records matched by title) is eliminated at the source

---
Task ID: recently-watched-accidental-fix
Agent: main
Task: Movies added to watchlist were appearing in Recently Watched — investigate root cause and prevent recurrence

Work Log:
- Investigated live DB via /api/media — found 10 watched movies total
- Identified 2 movies ("The Ex", "The General's Daughter") with rating=75 (the OLD RatingDialog default) and status="watched" — these were accidentally saved via the Library view's "Rate & Watch" button, which opened the dialog with a default of 75 and marked the movie as watched when the user clicked Save
- The other 8 watched movies have non-default ratings (78, 80, 81, 84, 87, 65) — these are intentional user ratings, kept as-is
- Root cause: combination of (a) "Rate & Watch" button label being ambiguous (user didn't realize clicking it would mark the movie as watched), (b) RatingDialog defaulting to 75 (high rating, easy to save by mistake), and (c) no easy way to unwatch from the Recently Watched section

Fixes applied:
- home-view RecentlyWatchedCard: added a quick "×" unwatch button (top-left, hover-revealed). Clicking it calls useWatchedMovieToggle({ action: "remove" }) which moves the movie back to the watchlist (watched=false, status=null, rating=null). Wrapped the card in a <div> instead of nested <button> to allow the inner unwatch button.
- library-view: renamed "Rate & Watch" button to "Mark Watched" with a clearer title tooltip. Added a separate "Remove" button on watchlist items so users can delete a watchlist entry without marking it watched. Also added handleQuickUnwatch helper that clears status only.
- rating-dialog: changed default rating from 75 → 50 (neutral, forces the user to actively choose). Added "adjust state when prop changes" pattern to reset to 50 each time the dialog opens. Updated DialogTitle to "Mark as watched & rate" and DialogDescription to explicitly say "Saving will mark this as watched and store your rating out of 100."
- Added /api/admin/reset-accidental-watched endpoint to bulk-reset movies with the suspicious signature (watched=true, userRating=75, status="watched") back to watchlist (watched=false, status="planned", userRating=null). Idempotent, optional ADMIN_REPAIR_SECRET protection.

Stage Summary:
- Recently Watched section now has a one-click unwatch button on each card (hover to reveal)
- Library "Rate & Watch" → "Mark Watched" with explicit copy
- RatingDialog default 75 → 50 (neutral, less accidental)
- Admin endpoint will bulk-reset the 2 accidental movies (The Ex, The General's Daughter) after deploy
- All TypeScript + ESLint checks pass; production build succeeds

---
Task ID: all-tab-with-status-badges
Agent: main
Task: Add an "All" tab to TV Tracking that shows every tracked show with a status badge (Finished / Up To Date / Watchlist)

Work Log:
- Added a new "All" tab as the first (default) tab in TvTrackingView
- Created `deriveTrackingStatus(show)` helper that maps a Media row's `status` field to one of: "finished" | "uptodate" | "watchlist"
  - status="finished" → finished
  - status="watched" + watched=true → finished (legacy compat, will be migrated on next episode toggle)
  - status="uptodate" → uptodate
  - everything else (status="planned", null, or watched=false) → watchlist
- Created `TrackingStatusBadge` component with three color-coded variants:
  - Finished: emerald Trophy badge
  - Up To Date: cyan Zap badge
  - Watchlist: purple BookOpen badge
- Created `AllShowsTab` that fetches all series (no status filter) with pagination (60/page, sorted A→Z)
  - Includes 4 filter chips: All / Finished / Up To Date / Watchlist — each shows the count from the current page
  - Clicking a chip filters the grid in-place (no page navigation)
- Created `AllShowCard` — poster + title + status badge + anime/seasons badges + episode count + year + user rating with progress bar
- Added `Layers` icon import from lucide-react for the "All" tab trigger
- Set the default tab to "all" so users land on the overview first
- All TypeScript + ESLint checks pass
- Production build succeeds

Stage Summary:
- New "All" tab is the default landing view for TV Tracking
- Each show card displays a colored status badge indicating which tracking state it belongs to:
  - FROM (ongoing, all aired eps watched) → cyan "Up To Date" badge
  - LOST (ended, all eps watched) → emerald "Finished" badge
  - New show just followed → purple "Watchlist" badge
- Filter chips let users drill into a specific status without leaving the tab
- Existing tabs (Watchlist / Up To Date / Finished / etc.) remain unchanged

---
Task ID: recently-profile-click-fix
Agent: main
Task: Apply patch tvtime_recently_profile_click_fix — fix Recently Watched opening empty/failed profiles

Work Log:
- Inspected uploaded zip (DIFF + PATCH_NOTES + AGENT_PROMPT)
- Verified repo state: home-view.tsx import line matched patch context exactly, use-tmdb.ts context matched
- Applied patch with `patch -p1 < DIFF_recently_profile_click_fix.patch` — applied cleanly with no fuzz/rejects to all 3 files:
  - src/app/api/media/recently/route.ts (new file, 149 lines)
  - src/components/views/home-view.tsx (modified)
  - src/hooks/use-tmdb.ts (modified)
- Ran `bun install` + `bunx prisma generate` (db:sync equivalent — schema unchanged, just regenerated client)
- TypeScript checks pass (`tsc --noEmit`)
- ESLint checks pass
- Production build succeeds — `/api/media/recently` registered as serverless route

Changes applied (per PATCH_NOTES):
- Added `GET /api/media/recently` — one fast canonical source merging:
  - Media watched movies (type=movie, watched=true)
  - Legacy WatchedMovie rows
  - Latest watched TV episodes (with show title/poster resolved via Media + FollowingShow)
- Each item includes `kind` ("movie"|"tv"), `tmdbId`, `hasProfile` (true only when tmdbId is valid), `watchedAt`, `subtitle` (e.g. "S2 • E5" for TV episodes)
- Added `useRecentlyWatched(limit=12)` hook in use-tmdb.ts with 30s staleTime
- Rewrote `RecentlyWatched` component in home-view.tsx:
  - Now uses useRecentlyWatched instead of useWatchedMovies
  - Skeleton loading state (6 shimmer cards) while fetching
  - Returns null when empty (no section header)
- Rewrote `RecentlyWatchedCard`:
  - Validates tmdbId + hasProfile before navigating; shows toast error if invalid
  - Routes to goMovie (kind=movie) or goTv (kind=tv)
  - Cards without hasProfile are aria-disabled and don't navigate
  - Badge shows "Movie" or "TV" instead of just a check
  - Eager image loading with fetchPriority="high" to avoid Chromium lazy-placeholder intervention
  - Unwatch (×) button only shows for movies (episode unwatching handled from TV profile)
  - Subtitle line shows "S2 • E5 • <date>" for TV episodes

Stage Summary:
- Recently Watched now opens valid movie/TV profiles reliably — no more empty/failed profile loads
- TV episodes appear alongside movies in Recently Watched (previously movies only)
- Invalid legacy/manual items (no tmdbId) are visually disabled instead of navigating to a broken profile
- Image loading intervention reduced via eager loading + fetch priority
- Skeleton state added for better loading UX

---
Task ID: emergency-recovery-postgresql
Agent: main
Task: Apply TVM-EMERGENCY-RECOVERY — revert TVM-01/02 SQLite migration, restore PostgreSQL connection to production DB

Work Log:
- Inspected uploaded TVM-EMERGENCY-RECOVERY.zip (211 files)
- Read AGENT-PROMPT-AR.md, README-RECOVERY-AR.md, WHAT-CHANGED-AR.md, APPLY-RECOVERY.sh
- Understood root cause: TVM-01/02 switched Prisma from PostgreSQL to SQLite + bundled a local db/custom.db, so the Vercel deployment read the empty local DB instead of the production PostgreSQL — library appeared empty
- Cloned fresh repo (clean state at commit 257cd2e = TVM-01/02 applied)
- Applied recovery via rsync: copied TvTime-main/ from the recovery package over the repo, excluding .git/, .env, db/, node_modules/, bun.lock, .next/, dev.log, .zscripts/dev.pid
- Verified recovery state:
  - prisma/schema.prisma: provider = "postgresql" ✓
  - package.json build script: `node scripts/assert-production-db.mjs && prisma generate && next build` (no db push/migrate) ✓
  - db:push / db:migrate / db:reset / db:sync all call refuse-destructive-db-command.mjs ✓
  - db:verify:readonly runs verify-production-db-readonly.mjs (read-only counts) ✓
  - assert-production-db.mjs refuses to build unless DATABASE_URL is postgresql: protocol ✓
- git rm --cached .env db/custom.db — untracked both files (kept on disk, now gitignored)
- Verified .gitignore excludes .env*, /db/, *.db, db/backups/
- bun install: 826 packages ok
- bunx tsc --noEmit: passed (no errors)
- bunx eslint (recovery-touched files): 1 pre-existing lint error in tv-detail-view.tsx (useEffect+setState pattern that was in the pre-TVM version). Fixed by converting to "adjust state during render" pattern (same fix applied in a prior task). Re-lint: clean.
- npm run build (with fake postgresql:// URL to satisfy assert-production-db.mjs): succeeded — 21 routes built

Recovery files added:
- scripts/assert-production-db.mjs — refuses build unless DATABASE_URL is postgresql:
- scripts/refuse-destructive-db-command.mjs — blocks db:push/migrate/reset/sync
- scripts/verify-production-db-readonly.mjs — read-only row counts
- .env.example — documents expected PostgreSQL URL format
- src/lib/local-storage.ts — restored (was deleted by TVM-02)

Recovery files removed:
- scripts/backup-sqlite.mjs, scripts/check-canonical-db.mjs, scripts/migrate-canonical-db.mjs, scripts/preflight-canonical-sqlite.mjs
- src/lib/library-compat.ts, src/lib/media-repository.ts, src/lib/media-state.ts
- delivery/ folder (TVM-01/02 docs)
- .env (untracked), db/custom.db (untracked)

Stage Summary:
- Prisma provider restored to PostgreSQL
- Build pipeline = assert-production-db → prisma generate → next build (no schema mutations)
- All destructive Prisma commands (db:push/migrate/reset/sync) refuse to run
- .env and db/custom.db are no longer tracked by git (gitignored)
- TypeScript + ESLint (patch-touched files) clean; production build succeeds
- Vercel DATABASE_URL must be restored to the original PostgreSQL URL (I had overwritten it with file:../db/custom.db during the TVM-01/02 task — needs to be set back to the original Neon PostgreSQL connection string)
