# TvTime — TV Time Clone

A complete movie & TV show tracking application built with Next.js 16, TypeScript, Prisma (PostgreSQL), and TMDB API.

## Architecture

### Source of Truth

- **Media** table is the single canonical source for all movies and series.
- **WatchedEpisode** table is the episode-level truth for TV show progress.
- **Rating** table stores episode ratings (`episode:S:E` identity) separately from title ratings.
- Legacy tables (WatchlistItem, WatchedMovie, FollowingShow) were migrated to Media in TVM-10 and are no longer read at runtime.

### TV Show States

States are derived ONLY from episode records via the central engine (`src/lib/tv-status-engine.ts`). Ratings never affect state.

| State | Meaning |
|-------|---------|
| `planned` | In watchlist only |
| `not_started` | Followed but no episodes watched |
| `watching` | Some aired episodes watched, more aired remain |
| `uptodate` | Ongoing show + all aired episodes watched |
| `finished` | Officially ended (Ended/Canceled) + all final aired episodes watched |

**Key rules:**
- `finished` requires TMDB status = Ended/Canceled + all final aired episodes watched
- Ongoing shows can never be `finished` (only `uptodate`)
- Future episodes are excluded from progress
- Episode rating is independent and does not affect show state
- Whole-series rating is locked until the show is officially ended + fully watched

### Three Worlds

The app is split into three independent sections:

1. **Movies** — non-anime movies only (Watchlist + Watched tabs)
2. **TV Shows** — non-anime series only (all tracking filters)
3. **Anime** — all anime (movies + series) with Watchlist + Watched tabs

Items can be moved between worlds via the `Move to Anime` / `To Movies` / `To TV Shows` buttons, which toggle `isAnime` on the same Media record without duplicating or losing progress.

### Watch/Rating Separation (TVM-03)

- Saving a rating writes ONLY `userRating`
- Removing a rating clears ONLY `userRating`
- Adding/removing watched does NOT touch rating
- API rejects requests that combine rating + watch in one payload
- Rating-only items don't enter Watchlist or Watched

## Database

- **Provider**: PostgreSQL (Neon)
- **DATABASE_URL**: Set in Vercel environment variables (must be `postgresql://...`)
- **Reviewed migrations only**: destructive `db push`/`reset` commands remain blocked. Production schema changes are delivered as reviewed Prisma migrations.
- **Migration deployment**: run `npm run db:migrate:status`, take a verified backup, then run `npm run db:migrate:deploy` in the approved maintenance window.
- **Build pipeline**: `assert-production-db` → `prisma generate` → read-only schema contract verification → `next build`
  - The build never applies a migration or writes to production.
  - It fails before deployment when `Media.isFollowing`, the canonical media identity constraint, or the `series` type normalization is missing.

### Safety-Critical Files

Changes to these files require explicit review and must be delivered with verification and rollback instructions:

| File | Purpose |
|------|---------|
| `prisma/schema.prisma` | Database schema (PostgreSQL) |
| `prisma/migrations/**` | Reviewed, ordered production schema changes |
| `package.json` | Dependencies, build and migration safety scripts |
| `scripts/assert-production-db.mjs` | PostgreSQL build guard |
| `scripts/verify-required-schema.mjs` | Read-only schema compatibility guard |
| `next.config.ts` | Next.js runtime/build configuration |

## Development

### Prerequisites

- Node.js 18+ or Bun
- PostgreSQL database (Neon, Supabase, or local)
- TMDB API key (optional — has a default)

### Setup

```bash
# Install dependencies
bun install  # or npm install

# Set up environment
cp .env.example .env
# Edit .env: DATABASE_URL="postgresql://user:pass@host/db"

# Generate Prisma client
bunx prisma generate

# Run development server
bun run dev  # or npm run dev
```

### Build

```bash
bun run build  # or npm run build
# Runs: assert-production-db → prisma generate → read-only schema verification → next build
```

### Lint

```bash
bun run lint  # or npm run lint
```

### Database Verification (Read-Only)

```bash
npm run db:verify:readonly
# Counts rows in all tables without modifying anything
```

## API Overview

### Media
- `GET /api/media` — list with filters (type, status, watched, rated, isAnime, search)
- `GET /api/media/[id]` — get single item
- `PATCH /api/media/[id]` — update (rating OR watch, never both)
- `POST /api/media/find-or-create` — find or create by tmdbId
- `GET /api/media/recently` — recently watched (movies + episodes)
- `GET /api/media/stats` — aggregate stats

### Library
- `GET /api/library/stats` — full statistics
- `GET /api/library/counts` — global counts (TVM-12)
- `GET /api/library/watched-episodes` — episode tracking
- `POST /api/library/watched-episodes` — mark episode(s) watched
- `DELETE /api/library/watched-episodes` — unmark episode
- `GET /api/library/export` — export library as JSON
- `POST /api/library/import` — import library from JSON

### TV Tracking
- `GET /api/tv-tracking` — list shows with derived states + global counts
- Categories: all, watchlist, uptodate, finished, finished-anime, upcoming, havent-watched, havent-started

### TMDB Proxy
- `GET /api/tmdb/[...path]` — proxies all TMDB API calls (caching, no CORS)

## TMDB Integration

- All TMDB calls are proxied through `/api/tmdb/*` routes
- Server-side caching (5 minutes default)
- TV status engine fetches show detail to determine: official status, aired episodes, next episode
- Future episodes excluded from progress calculation
- TMDB cache is broken when `next_episode_to_air` date arrives (TVM-06)

## Key Libraries

| File | Purpose |
|------|---------|
| `src/lib/tv-status-engine.ts` | Central TV state derivation (pure logic, no DB) |
| `src/lib/tv-status-server.ts` | Server-side TMDB metadata fetching |
| `src/lib/tv-status-repair.ts` | Legacy completion backfill |
| `src/lib/tv-rating-eligibility.ts` | Whole-series rating lock logic |
| `src/lib/episode-rating.ts` | Independent episode rating logic |
| `src/lib/library-counts.ts` | Central count service (TVM-12) |
| `src/lib/legacy-library-migration.ts` | One-time legacy table migration (TVM-10) |

## Verification Scripts

```bash
# TVM-03/04/05 state engine + future episode protection
node scripts/verify-tvm-03-04-05.mjs

# TVM-06/07/08/09 rating lock + episode rating
node scripts/verify-tvm-06-09.mjs

# TVM-10/11/12/13 canonical migration + counts + filters
node scripts/verify-tvm-10-13.mjs

# TVM-WORLDS Movies/TV/Anime separation
node scripts/verify-world-separation.mjs

# Unit tests
node --experimental-strip-types scripts/test-tv-status-engine.ts
node --experimental-strip-types scripts/test-tvm-06-09.ts
```

## Deployment (Vercel)

1. Push to GitHub `main` branch
2. Before the first deployment containing a new migration, run `npm run db:migrate:status`, take a verified database backup, and run `npm run db:migrate:deploy` from an approved maintenance environment.
3. Vercel auto-deploys only after the migration is ready; the build guard blocks an incompatible schema.
4. Environment variables:
   - `DATABASE_URL` — PostgreSQL connection string (must be `postgresql://`)
   - `TMDB_API_KEY` — optional (has default)
   - `ADMIN_REPAIR_SECRET` — optional, protects admin endpoints
5. Build: `assert-production-db.mjs` → `prisma generate` → `verify-required-schema.mjs` → `next build`

### Admin Endpoints

- `GET /api/admin/repair-posters` — fix stale movie posters from TMDB
- `GET /api/admin/reset-accidental-watched` — dry-run by default, resets accidental watched movies
- `GET /api/admin/migrate-legacy-library` — manual legacy migration trigger
- `GET /api/admin/backfill-watched-from-ratings` — set watched=true for rated movies
- `GET /api/admin/backfill-watchlist-status` — set status=planned for unwatched items with NULL status

## Constraints

- **Never** change `prisma/schema.prisma` without a reviewed migration plan
- **Never** run `prisma db push`/`migrate`/`reset` in production
- **Never** change Prisma provider from PostgreSQL
- **Never** treat a rating as watched or vice versa
- **Never** allow future episodes to count as progress
- **Never** write to the database during GET requests (TVM-27)
