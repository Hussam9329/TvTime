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
