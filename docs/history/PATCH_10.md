# Patch 10 — performance budgets, CI consolidation, documentation and cleanup

## Scope

Patch 10 completes the performance and quality phase after Patches 01–09. It
addresses the heavy TV counter path, unbounded sparse Discover scans, unreliable
serverless cache completion, stale quality gates and documentation, inconsistent
branding, and a small reviewed set of unreachable or superseded runtime files.

## User-visible behavior

- TV tracking badges load from one compact read-only database statement. The
  counter request does not fetch TMDB metadata, deserialize episode-key arrays,
  create users, run legacy migration, repair rows, or write cache data.
- Sparse Seen/Unseen discovery scans at most eight TMDB pages in one HTTP
  request. When more catalogue scanning is needed, the response is marked
  partial and returns a deterministic cursor for the next request.
- Cached TV metadata writes are awaited before a successful metadata fetch
  returns, reducing repeated cold-cache calls on serverless invocations.
- User-facing product text and backup filenames consistently use `TvTime`.
  `CineTrack` remains accepted only as a legacy backup alias.

## Engineering changes

### Fast TV counts

`src/lib/tv-tracking-counts.ts` derives compact states from persisted Media
state, one aggregate episode count, and fresh numeric cache boundaries. The
`countsOnly=true` route returns before the full snapshot and publishes a one
query budget in both its JSON response and headers.

This path intentionally favors a safe state when metadata is stale: any real
episode progress remains Watching instead of becoming Not Started. Exact list
views continue to use the full per-episode snapshot.

### Discover request budget

`src/lib/discover-budget.ts` owns cursor parsing, batch sizing, the eight-page
request budget, and the three-page concurrency ceiling. The filtered Discover
route returns `partial`, `has_more`, `next_cursor`, and scan diagnostics when the
budget is exhausted.

### Quality gate

- `verify:all` runs every maintained behavior/source suite and reports all
  failures instead of stopping at the first one.
- `verify:ci` aggregates strict ESLint, TypeScript and maintained suites.
- GitHub runs those three stages independently with matrix `fail-fast: false`.
- The schema workflow migrates an empty PostgreSQL 16 database, verifies its
  contract and performs the production build against that migrated schema.
- Strict ESLint has a zero-warning budget.

### Runtime and documentation

- Node.js 20.9.0 is pinned in `.nvmrc` and enforced by `package.json`.
- `TMDB_API_KEY` is documented as mandatory, matching runtime behavior.
- Backup v6, fast TV counts, Discover continuation, migration deployment and
  quality commands are documented in `README.md`.

### Reviewed cleanup

The following unmounted or superseded files were removed:

- `src/components/media/rating-stars.tsx`
- `src/components/media/continue-watching.tsx`
- `src/components/views/arabic-movie-schedule.tsx`
- `src/lib/local-storage.ts`

The old unreachable episode/season flow inside TV Tracking was also removed.
Episode mutation remains available through TV Detail, which retains the shared
previous-episode confirmation safety flow.

## Verification

Run:

```bash
npm run verify:patch-10
npm run lint:strict
npm run typecheck
npm run verify:all
npm run verify:ci
```

The production build requires a reachable PostgreSQL database whose reviewed
migrations have been applied. Do not point this command at production merely to
test the patch; use the empty-database CI workflow or an approved clone.

## Rollback

Patch 10 contains no database migration. Reverting its files restores the prior
counter and Discover behavior. A rollback also restores the deleted dead files,
but they were not mounted by the active application. The Backup v6 compatibility
contract introduced by Patch 09 is unchanged.
