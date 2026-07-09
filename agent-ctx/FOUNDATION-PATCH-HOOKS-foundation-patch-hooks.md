# Foundation Patch - Hooks

Task ID: FOUNDATION-PATCH-HOOKS
Agent: foundation-patch-hooks
Scope: Update all client hooks, components, and library API routes to talk to the new server-backed library (Media + WatchedEpisode tables in PostgreSQL) via the new `client-user.ts` helpers (`withUserId`, `userHeaders`, `getClientUserId`).

## Summary of changes

### 1. `src/hooks/use-tmdb.ts` (rewritten)
- Added `import { getClientUserId, userHeaders, withUserId } from "@/lib/client-user"`.
- Removed the `import { libStorage } from "@/lib/local-storage"` line; replaced with the comment `// Episode tracking is now server-backed via API`.
- Replaced the `import("@/lib/local-storage").WatchedEpisode` type alias with an inline `WatchedEpisodeDB` interface so the hook file no longer depends on the localStorage module.
- `findOrCreateMedia` now POSTs to `withUserId(new URL("/api/media/find-or-create", ...))` with `...userHeaders()`.
- Added a new `mediaToLibraryCompat(m)` helper right after `findOrCreateMedia` that maps a Media DB row into the legacy "library item" shape (`mediaType`, `posterPath`, `releaseDate`, `voteAverage`, `followedAt`, `watchedAt`, `value`) so existing call sites keep working.
- `useWatchlist` now uses `status: "planned"` (instead of `rated: "false"`), `withUserId`, `userHeaders`, and maps items through `mediaToLibraryCompat`.
- `useWatchedMovies` now uses `watched: "true"` (instead of `rated: "true"`), `withUserId`, `userHeaders`, and maps items through `mediaToLibraryCompat`.
- `useFollowing` now uses `status: "planned"` (instead of `isAnime` + `rated`), `withUserId`, `userHeaders`, and maps items through `mediaToLibraryCompat`.
- `useTrackedShows` uses `withUserId` + `userHeaders` and maps items through `mediaToLibraryCompat`.
- `useRatings` uses `withUserId` + `userHeaders` and maps items through `mediaToLibraryCompat`.
- `useWatchlistToggle`, `useWatchedMovieToggle`, `useFollowingToggle` — every `new URL("/api/media/...", ...)` is wrapped with `withUserId`, every PATCH/POST gets `...userHeaders()` in headers.
- `useRatingMutate` — same `withUserId`/`userHeaders` treatment, plus converts the 1-10 input scale to 0-100 with `userRating: args.value == null ? null : args.value * 10`.
- `useWatchedEpisodes` — replaced localStorage implementation with `fetch(withUserId(new URL("/api/library/watched-episodes", ...)), { headers: userHeaders() })`. Query key now includes `userId || getClientUserId()`.
- `useEpisodeToggle` — POST `/api/library/watched-episodes` (add) and DELETE with query params (remove), both carrying `userHeaders`. Invalidates `["lib", "watched-episodes"]` and `["lib", "stats"]` on success.
- `useBulkEpisodeToggle` — POST `/api/library/watched-episodes` with `{ showId, episodes }` body. Same invalidations.
- `useStats` — now reads from `/api/library/stats` (instead of `/api/media/stats`) so it includes watched-episode data, and uses `withUserId` + `userHeaders`.
- Added new `useShowProgress(showId)` hook right after `useStats`. It composes `useTvDetail` + `useWatchedEpisodes` + a `useQuery` that fetches **all** regular seasons (filtered to `season_number >= 1 && episode_count > 0`) via `tmdbGet<SeasonDetail>(tv/${showId}/season/${N})`. Returns a unified shape (`showDetail`, `watchedSet`, `watchedItems`, `totalEpisodes`, `watchedCount`, `nextEp`, `allEpisodes`, `seasons`, `lastWatchedDate`, `daysSinceLastWatch`, `nextEpAirDate`, `isUpcoming`, `isLoading`, `isError`) so callers no longer need to fan out to 4 separate `useSeasonDetail` calls.
- `useMedia` / `useMediaStats` — the shared `mediaGet` helper now uses `withUserId` and sends `userHeaders`.
- `useMediaUpdate` — PATCH now uses `withUserId(new URL(\`/api/media/${id}\`, ...))` and adds `...userHeaders()`.
- Added `isAnime` to the `MediaItemDB` interface (it was missing, but used in `library-view.tsx`).
- Extended `MediaStats.counts` with optional fields: `watchlist`, `watchlistMovies`, `watchlistShows`, `watchlistAnime`, `watchedMovies`, `watchedShows`, `watchedAnime`, `watchedEpisodes`, `following`, `ratings` so `library-view.tsx` can read them without TS errors.

### 2. `src/components/media/continue-watching.tsx`
- Replaced `useTvDetail` + `useWatchedEpisodes` + 4× `useSeasonDetail` + manual season walk with a single `const data = useShowProgress(showId);`.
- Destructured `watchedSet, watchedCount, totalEpisodes, nextEp, seasons, isLoading` from `data`.
- `markAllSeason` now uses `bulkToggle.mutate({ showId, episodes: unwatched })` (was a forEach loop of single `episodeToggle.mutate` calls).
- Imports updated: `useShowProgress`, `useEpisodeToggle`, `useBulkEpisodeToggle` from `@/hooks/use-tmdb`.

### 3. `src/components/media/media-card.tsx`
- Imported `SafeImage` from `@/components/media/safe-image`.
- Replaced both `<img>` tags (the w92 blur-up placeholder and the w342 main image) with `<SafeImage>`.

### 4. `src/components/profile/profile-dialog.tsx`
- Replaced `import { libStorage } from "@/lib/local-storage"` with `import { userHeaders, withUserId } from "@/lib/client-user"`.
- `onClearData` now DELETEs `withUserId(new URL("/api/library/clear", ...))` with `userHeaders()`, and invalidates both `["lib"]` and `["media"]` queries.
- `onExport` now fetches `withUserId(new URL("/api/library/export", ...))` with `userHeaders()`, parses the JSON, then downloads as a blob.
- `onImport` now POSTs the parsed JSON to `withUserId(new URL("/api/library/import", ...))` with `Content-Type` + `userHeaders()`, reads the `imported` counts from the response, and invalidates both `["lib"]` and `["media"]`.

### 5. `src/components/views/calendar-view.tsx`
- Swapped the `useTvDetail` import for `useShowProgress`.
- `followedToShow = followed.slice(0, 50)` (was 12).
- `showIds.slice(0, 20)` (was 8).
- `DayEpisode` now calls `useShowProgress(showId)` and looks up the matching episode from `progress.allEpisodes` (no more per-season `useSeasonDetail` calls).

### 6. `src/components/views/tv-tracking-view.tsx`
- Imports: removed `useTvDetail, useWatchedEpisodes, useSeasonDetail`, added `useShowProgress`.
- `useShowTrackingData` is now a one-liner that returns `useShowProgress(showId)`.
- `ShowProgressCard` was rewritten to read from `useShowProgress(showId)` (`progress.totalEpisodes`, `progress.watchedCount`, `progress.showDetail`, `progress.isLoading`) and uses a local `progressPct` for the bar/label (was previously using `progress` as a number).

### 7. `src/components/views/library-view.tsx`
- Imported `SafeImage` from `@/components/media/safe-image`.
- `TAB_CONFIG` field `rated: boolean` renamed to `isWatched: boolean`.
- The `useMedia` query now sends `status: config.isWatched ? undefined : "planned"` and `watched: config.isWatched ? "true" : undefined` (was `rated: "true"/"false"`).
- Mini stats now read `stats.data.counts?.watchlistMovies`, `watchedMovies`, `watchlistShows`, `watchedShows`, `watchlistAnime`, `watchedAnime` (with `?? 0` fallbacks).
- Poster `<img>` replaced with `<SafeImage>`.

### 8. `src/components/views/media-view.tsx`
- Imported `SafeImage`.
- Poster `<img>` in `MediaCard` replaced with `<SafeImage>`.

### 9. `src/components/media/safe-image.tsx` (pre-existing lint fix)
- The foundation patch left a `react-hooks/set-state-in-effect` lint error (calling `setCurrentSrc`/`setRetries` synchronously inside `useEffect`). Rewrote the component to use the React "adjust state when prop changes" pattern: track `prevSrc` + `usedFallback` in state, and compute `currentSrc` from `normalizedSrc`, `retries`, and `usedFallback` on each render. Removes the `useEffect` entirely. Lint now passes clean.

### 10. Library API routes

**`src/app/api/library/stats/route.ts`** — rewritten to combine Media + WatchedEpisode tables. Returns the full counts shape needed by Home, Library, Stats, and TV Tracking views:
- `counts`: `total, movies, series, books, games, rated, watched, planned, watchlist, watchlistMovies, watchlistShows, watchlistAnime, watchedMovies, watchedShows, watchedAnime, watchedEpisodes, showsWatched, following, ratings`.
- `watchTime`: `totalMinutes, totalHours, movieMinutes, episodeMinutes` (movie + series minutes come from rated Media rows; episode minutes estimated at 45min × watched episode count).
- `episodesByShow`, `episodesByMonth`, `ratingDist`, `avgRating`, `user`.

**`src/app/api/library/export/route.ts`** — exports `library.media` (normalized) + `library.watchedEpisodes` (version 2 format). Still includes `user` info.

**`src/app/api/library/import/route.ts`** — accepts both version 2 (`library.media` + `library.watchedEpisodes`) and version 1 (legacy `library.watchlist/watchedMovies/following/ratings`). The legacy sections are converted into Media rows on import (e.g. watchlist → `status: "planned"`, watchedMovies → `watched: true, status: "watched"`, ratings → `userRating: value * 10`). Returns `{ ok: true, imported: { media, watchedEpisodes, watchlist, watchedMovies, following, ratings } }`.

**`src/app/api/library/clear/route.ts`** — DELETE now wipes Media + WatchedEpisode + the legacy tables (WatchlistItem, WatchedMovie, FollowingShow, Rating) for safety. The User record is preserved.

**`src/app/api/library/watched-episodes/route.ts`** — already used `parseUserId(req)` + `getOrCreateUser(userId)`, so it already works with the new userId-based schema. Verified, no changes needed.

### 11. `src/lib/db.ts` (incidental fix)
- The previous foundation patch had broken this file by replacing `import { PrismaClient } from '@prisma/client'` with `import { db } from '@/lib/db'` (a self-import) and leaving `PrismaClient` unbound. Restored the correct import so the Prisma client actually instantiates. This unblocks every API route that uses `db`.

## Verification
- `bun run lint` — passes clean (exit 0).
- `bunx tsc --noEmit --skipLibCheck` — 2 remaining errors, both pre-existing in `src/components/views/movie-detail-view.tsx` (lines 81 and 95: `m.title` is `string | undefined` per the TMDB type, passed to a hook that wants `string`). These were not introduced by this patch (the file is unchanged from HEAD) and ESLint does not flag them.
- All `libStorage` references in `src/hooks/use-tmdb.ts` and `src/components/profile/profile-dialog.tsx` are gone. The only remaining `libStorage` reference is the export inside `src/lib/local-storage.ts` itself (kept for any future legacy consumers).

## Notes for downstream agents
- `useShowProgress` is the canonical way to get show progress now. It composes TMDB + watched-episodes API and returns everything the old `useShowTrackingData` returned, plus `isError`. Continue-watching, calendar, and TV-tracking views are already migrated.
- The `mediaToLibraryCompat` helper is intentionally permissive (it falls back across multiple field names: `posterPath ?? poster`, `releaseDate ?? year`, etc.) so it can absorb both raw Media rows and any legacy localStorage-shaped data.
- The library stats endpoint now requires both `Media` and `WatchedEpisode` tables to exist in PostgreSQL — both are present in the current Prisma schema.
- All client → API calls now carry the user id both as a `userId` query param (via `withUserId`) and as a `x-user-id` header (via `userHeaders`). The server accepts either.
