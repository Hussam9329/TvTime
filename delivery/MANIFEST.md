# Delivery Manifest — TVM-01 + TVM-02

- Added files: **14**
- Modified files: **38**
- Deleted files: **1**
- Implementation paths before this manifest: **53**
- Final unified patch paths including this manifest: **54**

## Added

- `.env.example`
- `delivery/AGENT-PROMPT-AR.md`
- `delivery/APPLY-COMMANDS.sh`
- `delivery/CHANGELOG-AR.md`
- `delivery/README-AR.md`
- `delivery/VALIDATION.md`
- `delivery/WHAT-TO-CHECK-AR.md`
- `scripts/backup-sqlite.mjs`
- `scripts/check-canonical-db.mjs`
- `scripts/migrate-canonical-db.mjs`
- `scripts/preflight-canonical-sqlite.mjs`
- `src/lib/library-compat.ts`
- `src/lib/media-repository.ts`
- `src/lib/media-state.ts`

## Modified

- `.env`
- `.zscripts/build.sh`
- `.zscripts/dev.sh`
- `package.json`
- `prisma/schema.prisma`
- `scripts/add-finished-shows.ts`
- `scripts/add-following-shows.ts`
- `scripts/detect-anime.ts`
- `scripts/fix-shows.ts`
- `scripts/fix-watched-shows.ts`
- `scripts/import-backup.ts`
- `scripts/mark-all-episodes-watched.ts`
- `scripts/repair-media-posters.mjs`
- `src/app/api/admin/repair-posters/route.ts`
- `src/app/api/admin/reset-accidental-watched/route.ts`
- `src/app/api/library/export/route.ts`
- `src/app/api/library/following/route.ts`
- `src/app/api/library/import/route.ts`
- `src/app/api/library/ratings/route.ts`
- `src/app/api/library/stats/route.ts`
- `src/app/api/library/watched-episodes/route.ts`
- `src/app/api/library/watched-movies/route.ts`
- `src/app/api/library/watchlist/route.ts`
- `src/app/api/media/[id]/route.ts`
- `src/app/api/media/find-or-create/route.ts`
- `src/app/api/media/recently/route.ts`
- `src/app/api/media/route.ts`
- `src/app/api/media/stats/route.ts`
- `src/app/api/tv-tracking/route.ts`
- `src/components/media/rating-dialog.tsx`
- `src/components/views/home-view.tsx`
- `src/components/views/library-view.tsx`
- `src/components/views/media-view.tsx`
- `src/components/views/tv-detail-view.tsx`
- `src/components/views/tv-tracking-view.tsx`
- `src/hooks/use-tmdb.ts`
- `src/lib/media-normalize.ts`
- `src/lib/tmdb.ts`

## Deleted

- `src/lib/local-storage.ts`

## Package contents

- Full modified `TvTime-main` project.
- Unified `TVM-01-02.patch`.
- Identical `TVM-01-02.diff`.
- Ready Agent prompt.
- Arabic implementation notes and changelog.
- Automated application commands.
- Validation report and post-apply checklist.
