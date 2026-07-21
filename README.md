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
3. **Anime** — all anime (movies + series) with Watchlist, Not Started, In Progress, and Watched tabs

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
- **Migration deployment**: new databases are built completely from `prisma/migrations`; existing db-push installations must follow `MIGRATION_BASELINE.md` on a verified clone before the baseline is recorded. Run `npm run db:migrate:status`, take a verified backup, then run `npm run db:migrate:deploy` in the approved maintenance window.

### Safe read-only database audit

`scripts/db-audit.py` accepts a connection only from `TVTIME_AUDIT_DATABASE_URL`.
Use a dedicated PostgreSQL role with `SELECT` access only; the script refuses
database owners, object owners, bypass-RLS roles, and roles with table write
privileges. It also avoids printing user profile records or connection values.

Keep the populated value in an ignored local environment file or an operator
secret manager, then run:

```bash
python3 scripts/db-audit.py
```

Do not copy the application or migration `DATABASE_URL` into the audit variable.
See `SECURITY.md` for credential rotation and Git-history cleanup steps.
- **Build pipeline**: database-target validation → static migration-history verification → `prisma generate` → read-only live schema/RLS verification → `next build`
  - The build never applies a migration or writes application data.
  - It fails before deployment when a table, required column, index, constraint, RLS policy, or migration record is missing.
  - A GitHub Actions PostgreSQL service proves that the complete migration history can build an empty database.

## Authentication safety

Production is fail-closed. A missing or weak login secret returns a safe 503/locked login screen instead of exposing a publicly writable application.

- `APP_PASSWORD` is required in production and must contain at least 12 characters.
- `SESSION_SECRET` is independently required and must contain at least 32 characters; it never falls back to `APP_PASSWORD`.
- `APP_USERNAME` is optional and adds a username check to the login form.
- Public mode requires `ALLOW_PUBLIC_MODE=true` **and** an explicitly non-production environment. It is refused on Vercel Production.
- `next` after login is restricted to a same-origin application path; absolute and protocol-relative redirects are rejected.
- In authenticated mode, every user-owned API route takes its owner from the verified JWT `sub`; browser-supplied `userId` query/header values are ignored.

For local public development only:

```bash
ALLOW_PUBLIC_MODE=true npm run dev
```

Run the focused checks with `npm run verify:auth-boundary` and `npm run verify:authorization`.

### Safety-Critical Files

Changes to these files require explicit review and must be delivered with verification and rollback instructions:

| File | Purpose |
|------|---------|
| `prisma/schema.prisma` | Database schema (PostgreSQL) |
| `prisma/migrations/**` | Reviewed, ordered production schema changes |
| `package.json` | Dependencies, build and migration safety scripts |
| `scripts/assert-production-db.mjs` | PostgreSQL build guard |
| `scripts/verify-required-schema.mjs` | Read-only schema, migration and RLS compatibility guard |
| `scripts/verify-migration-history.mjs` | Static coverage guard for every Prisma model |
| `MIGRATION_BASELINE.md` | Existing-database baseline reconciliation runbook |
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
# Runs: target guard → migration-history guard → prisma generate → read-only live schema/RLS guard → next build
```

### Lint

```bash
bun run lint  # or npm run lint
```

### Database Verification (Read-Only)

```bash
npm run db:verify:migrations
# Verifies that every Prisma model has an ordered migration

npm run db:verify:schema
# Verifies the deployed tables, indexes, constraints, RLS policies and migration records

npm run db:verify:readonly
# Counts rows in the canonical/legacy tables without modifying anything
```

For a database that predates the baseline, read `MIGRATION_BASELINE.md` before running any migration command.

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
- `GET /api/library/export` — return a versioned manifest or a cursor-paged collection page (each response stays below the serverless payload budget)
- `POST /api/library/import` — create a temporary validated import session; this endpoint does not change library rows
- `POST /api/library/import/[sessionId]/chunks` — upload checksummed chunks into user-scoped staging
- `POST /api/library/import/[sessionId]/finalize` — verify all counts/sequences and return a merge preview
- `POST /api/library/import/[sessionId]/commit` — apply the previewed restore in one database transaction
- `DELETE /api/library/import/[sessionId]` — cancel a non-committed import and remove its staging rows

### Backup and restore safety

The profile dialog exports **version 5 NDJSON**. It requests Media, watched episodes, and episode ratings in small cursor pages, then assembles the downloadable file in the browser; no single Vercel Function response contains the whole backup. Version 1–4 JSON backups remain accepted through a compatibility adapter.

Restore is intentionally two-phase:

1. The browser streams the file and uploads chunks smaller than 1.5 MB with a SHA-256 checksum.
2. The server validates and normalizes every row into `LibraryImport*` staging tables. Invalid chunks write nothing.
3. Finalize checks contiguous chunk sequences, manifest totals, duplicates, and merge impact, then shows the user a preview.
4. Only an exact preview-bound confirmation starts the final transaction. Target library tables either all commit together or remain unchanged.

Import sessions expire after 24 hours, are isolated by the authenticated user, and can be cancelled before commit. A restore currently covers the same canonical data as export: Media, watched episodes, and episode-level ratings. Diary, notifications, and custom lists remain scheduled for the data-lifecycle patch.

### TV Tracking
- `GET /api/tv-tracking` — list shows with derived states + global counts
- Categories: all, watchlist, uptodate, finished, upcoming, havent-watched, havent-started

### TV cache and episode-mutation safety

- Cached TV metadata now retains the original language, origin countries and genres required to keep Arabic and anime classification stable. Older incomplete cache rows are refreshed before a classification-sensitive mutation.
- Shows with real episode progress request exact aired-episode keys from the cache. When an old/incomplete boundary is encountered, progress remains `Watching` but is marked unverified instead of falling back to `Not Started`.
- Marking or unmarking an episode obtains TMDB metadata before opening the database transaction. The episode row and derived `Media` status/classification are then committed together under a row lock with a bounded timeout; metadata failures therefore leave both unchanged.

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
# Run every maintained safety and user-facing verification
npm run verify:all
```

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

# Patch-specific regression suites
npm run verify:patch-05
npm run verify:patch-06
npm run verify:patch-07
```

## Deployment (Vercel)

1. Push to GitHub `main` branch
2. For an existing db-push database, complete the clone procedure in `MIGRATION_BASELINE.md`. Before every deployment containing a migration, run `npm run db:migrate:status`, take a verified backup, and run `npm run db:migrate:deploy` from an approved maintenance environment.
3. Vercel auto-deploys only after the migration is ready; the build guard blocks an incompatible schema.
4. Environment variables:
   - `DATABASE_URL` — PostgreSQL connection string (must be `postgresql://`)
   - `TMDB_API_KEY` — TMDB server API key
   - `APP_PASSWORD` — production login password, 12+ characters
   - `SESSION_SECRET` — independent JWT signing secret, 32+ characters
   - `APP_USERNAME` — optional login username
   - `ADMIN_REPAIR_SECRET` — independent 32+ character secret for intentional admin repairs
5. Build: `assert-production-db.mjs` → `verify-migration-history.mjs` → `prisma generate` → `verify-required-schema.mjs` → `next build`

### Admin operations

All admin operations:

- accept `POST` only;
- require the signed owner session plus `Authorization: Bearer <ADMIN_REPAIR_SECRET>`;
- reject cross-site browser requests;
- are scoped to the authenticated owner;
- run as a read-only preview unless the JSON body contains `"apply": true` and the exact operation confirmation.

Preview example:

```bash
curl -X POST https://your-host.example/api/admin/repair-posters \
  -H "Authorization: Bearer $ADMIN_REPAIR_SECRET" \
  -H "Content-Type: application/json" \
  -b "tvtime_session=<owner-session-cookie>" \
  --data '{}'
```

Apply example:

```bash
curl -X POST https://your-host.example/api/admin/repair-posters \
  -H "Authorization: Bearer $ADMIN_REPAIR_SECRET" \
  -H "Content-Type: application/json" \
  -b "tvtime_session=<owner-session-cookie>" \
  --data '{"apply":true,"confirm":"APPLY:repair-posters"}'
```

Available operation names are `repair-posters`, `reset-accidental-watched`, `migrate-legacy-library`, `backfill-watched-from-ratings`, `backfill-watchlist-status`, `backfill-tmdb-ids`, and `dedup-media`. The preview response returns `confirmationForApply` so operators do not have to guess the token.

## Constraints

- **Never** change `prisma/schema.prisma` without a reviewed migration plan
- **Never** run `prisma db push`/`migrate`/`reset` in production
- **Never** change Prisma provider from PostgreSQL
- **Never** treat a rating as watched or vice versa
- **Never** allow future episodes to count as progress
- **Never** write to the database during GET requests (TVM-27)
- **Never** bypass staged validation by posting a whole backup directly to an import commit route
- **Never** trust client record counts or checksums without server-side verification
