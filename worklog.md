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
