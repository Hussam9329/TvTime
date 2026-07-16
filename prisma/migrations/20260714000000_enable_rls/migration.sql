-- Enable Row-Level Security on all user-data tables.
--
-- Design:
-- - RLS is ENABLED (not FORCED). This means role `neondb_owner` (Prisma's
--   connection role) is still allowed to bypass RLS, while any non-superuser
--   role (e.g. a future read-only analyst role) is subject to RLS.
-- - Per-table policies use the session variable `app.current_user_id`. When
--   that variable is set (via `SET LOCAL` inside a Prisma transaction), the
--   policy narrows rows to that user. When it is NOT set, the policy denies
--   all rows — fail-closed.
-- - This migration is safe to apply on production: it adds policies but does
--   not remove or alter any data. Rolling back is `DROP POLICY` + `ALTER
--   TABLE ... DISABLE ROW LEVEL SECURITY` per table.

-- Helper: define a single policy per table that grants rows where the
-- session user matches the row's userId.
-- The default behavior when the session variable is unset is NULL comparison,
-- which evaluates to FALSE → no rows returned. Fail-closed.

CREATE OR REPLACE FUNCTION tvtime_current_user_id() RETURNS TEXT
LANGUAGE sql STABLE AS $$
  SELECT NULLIF(current_setting('app.current_user_id', true), '')::text
$$;

ALTER TABLE "Media" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS media_isolate_own_rows ON "Media";
CREATE POLICY media_isolate_own_rows ON "Media"
  USING ("userId" = tvtime_current_user_id())
  WITH CHECK ("userId" = tvtime_current_user_id());

ALTER TABLE "WatchedEpisode" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS watched_episode_isolate_own_rows ON "WatchedEpisode";
CREATE POLICY watched_episode_isolate_own_rows ON "WatchedEpisode"
  USING ("userId" = tvtime_current_user_id())
  WITH CHECK ("userId" = tvtime_current_user_id());

ALTER TABLE "Rating" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS rating_isolate_own_rows ON "Rating";
CREATE POLICY rating_isolate_own_rows ON "Rating"
  USING ("userId" = tvtime_current_user_id())
  WITH CHECK ("userId" = tvtime_current_user_id());

ALTER TABLE "User" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS user_isolate_own_row ON "User";
CREATE POLICY user_isolate_own_row ON "User"
  USING (id = tvtime_current_user_id())
  WITH CHECK (id = tvtime_current_user_id());

-- Legacy tables (still present in schema, kept for migration safety)
ALTER TABLE "WatchlistItem" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS watchlist_item_isolate_own_rows ON "WatchlistItem";
CREATE POLICY watchlist_item_isolate_own_rows ON "WatchlistItem"
  USING ("userId" = tvtime_current_user_id())
  WITH CHECK ("userId" = tvtime_current_user_id());

ALTER TABLE "WatchedMovie" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS watched_movie_isolate_own_rows ON "WatchedMovie";
CREATE POLICY watched_movie_isolate_own_rows ON "WatchedMovie"
  USING ("userId" = tvtime_current_user_id())
  WITH CHECK ("userId" = tvtime_current_user_id());

ALTER TABLE "FollowingShow" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS following_show_isolate_own_rows ON "FollowingShow";
CREATE POLICY following_show_isolate_own_rows ON "FollowingShow"
  USING ("userId" = tvtime_current_user_id())
  WITH CHECK ("userId" = tvtime_current_user_id());

-- Note: _prisma_migrations is left without RLS — it is internal to Prisma.
