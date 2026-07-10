# Validation Report — TVM-01 + TVM-02

## Static validation

- TypeScript/TSX syntax: **123 files, 0 syntax errors** (application and TypeScript maintenance scripts).
- MJS scripts: **6 files passed `node --check`**.
- Shell scripts: **7 files passed `bash -n`** including the automated delivery script.
- `package.json`: valid JSON.
- PostgreSQL/Neon runtime references: none in Prisma, app source, scripts, package scripts, or runtime shell scripts.
- Legacy Prisma reads/writes: none in Runtime routes/scripts, excluding the intentional one-time migration and full-library clear route.
- Media state in localStorage: none. Remaining localStorage usage is Zustand UI/user identity persistence only.
- Unified patch application: passed on a fresh copy of the original project; the patched tree matched the prepared project exactly.

## Isolated database simulation

The original SQLite file was copied to a temporary test database. The source database in the delivered project was not modified during packaging.

Legacy source counts:

- WatchlistItem: 2
- WatchedMovie: 2
- FollowingShow: 4
- Rating: 1
- WatchedEpisode: 3

Result after simulated canonical merge:

- Canonical Media rows: 7
- completed: 2
- planned: 2
- watching: 3
- failures: 0

A synthetic rating-only row was checked with this expected invariant:

```text
libraryState = none
watched = false
status = null
userRating = 90
```

Result: passed.

## Full dependency/build validation

An npm dependency installation was attempted in the packaging environment, but it exceeded the available download timeout before dependencies were installed. Therefore, a complete `prisma generate` + `next build` was not claimed as completed in that environment.

The provided `db:sync`, `db:verify`, and `build` commands must be run in the target development/deployment environment. The build script is fail-fast: database backup, preflight, Prisma sync, canonical migration, and database verification execute before Next.js build.
