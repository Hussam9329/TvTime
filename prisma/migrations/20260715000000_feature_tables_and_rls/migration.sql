-- Add the Diary, Notifications and Custom Lists models that already exist in
-- prisma/schema.prisma. The migration is additive and deliberately tolerant of
-- installations where these tables were previously created with `db push`.

BEGIN;
SET LOCAL lock_timeout = '15s';
SET LOCAL statement_timeout = '10min';

CREATE TABLE IF NOT EXISTS "WatchSession" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "mediaId" TEXT,
  "mediaType" TEXT NOT NULL,
  "tmdbId" INTEGER NOT NULL,
  "title" TEXT NOT NULL,
  "season" INTEGER,
  "episode" INTEGER,
  "watchedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "duration" INTEGER,
  "rewatch" BOOLEAN NOT NULL DEFAULT false,
  "rating" INTEGER,
  "source" TEXT,
  "notes" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "WatchSession_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "Notification" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "type" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "body" TEXT NOT NULL,
  "tmdbId" INTEGER,
  "mediaType" TEXT,
  "read" BOOLEAN NOT NULL DEFAULT false,
  "scheduledFor" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Notification_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "CustomList" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "description" TEXT,
  "isPublic" BOOLEAN NOT NULL DEFAULT false,
  "color" TEXT NOT NULL DEFAULT '#f59e0b',
  "slug" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "CustomList_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "CustomListItem" (
  "id" TEXT NOT NULL,
  "listId" TEXT NOT NULL,
  "tmdbId" INTEGER NOT NULL,
  "mediaType" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "posterPath" TEXT,
  "addedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "order" INTEGER NOT NULL DEFAULT 0,
  CONSTRAINT "CustomListItem_pkey" PRIMARY KEY ("id")
);

-- Repair a partially-created db-push installation without dropping data.
ALTER TABLE "WatchSession"
  ADD COLUMN IF NOT EXISTS "mediaId" TEXT,
  ADD COLUMN IF NOT EXISTS "mediaType" TEXT,
  ADD COLUMN IF NOT EXISTS "tmdbId" INTEGER,
  ADD COLUMN IF NOT EXISTS "title" TEXT,
  ADD COLUMN IF NOT EXISTS "season" INTEGER,
  ADD COLUMN IF NOT EXISTS "episode" INTEGER,
  ADD COLUMN IF NOT EXISTS "watchedAt" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP,
  ADD COLUMN IF NOT EXISTS "duration" INTEGER,
  ADD COLUMN IF NOT EXISTS "rewatch" BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS "rating" INTEGER,
  ADD COLUMN IF NOT EXISTS "source" TEXT,
  ADD COLUMN IF NOT EXISTS "notes" TEXT,
  ADD COLUMN IF NOT EXISTS "createdAt" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP;

ALTER TABLE "Notification"
  ADD COLUMN IF NOT EXISTS "type" TEXT,
  ADD COLUMN IF NOT EXISTS "title" TEXT,
  ADD COLUMN IF NOT EXISTS "body" TEXT,
  ADD COLUMN IF NOT EXISTS "tmdbId" INTEGER,
  ADD COLUMN IF NOT EXISTS "mediaType" TEXT,
  ADD COLUMN IF NOT EXISTS "read" BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS "scheduledFor" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "createdAt" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP;

ALTER TABLE "CustomList"
  ADD COLUMN IF NOT EXISTS "name" TEXT,
  ADD COLUMN IF NOT EXISTS "description" TEXT,
  ADD COLUMN IF NOT EXISTS "isPublic" BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS "color" TEXT DEFAULT '#f59e0b',
  ADD COLUMN IF NOT EXISTS "slug" TEXT,
  ADD COLUMN IF NOT EXISTS "createdAt" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP,
  ADD COLUMN IF NOT EXISTS "updatedAt" TIMESTAMP(3);

ALTER TABLE "CustomListItem"
  ADD COLUMN IF NOT EXISTS "tmdbId" INTEGER,
  ADD COLUMN IF NOT EXISTS "mediaType" TEXT,
  ADD COLUMN IF NOT EXISTS "title" TEXT,
  ADD COLUMN IF NOT EXISTS "posterPath" TEXT,
  ADD COLUMN IF NOT EXISTS "addedAt" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP,
  ADD COLUMN IF NOT EXISTS "order" INTEGER DEFAULT 0;

CREATE INDEX IF NOT EXISTS "WatchSession_userId_watchedAt_idx" ON "WatchSession"("userId", "watchedAt");
CREATE INDEX IF NOT EXISTS "WatchSession_userId_mediaType_idx" ON "WatchSession"("userId", "mediaType");
CREATE INDEX IF NOT EXISTS "WatchSession_mediaId_idx" ON "WatchSession"("mediaId");
CREATE INDEX IF NOT EXISTS "Notification_userId_read_idx" ON "Notification"("userId", "read");
CREATE INDEX IF NOT EXISTS "Notification_userId_createdAt_idx" ON "Notification"("userId", "createdAt");
CREATE INDEX IF NOT EXISTS "CustomList_userId_idx" ON "CustomList"("userId");
CREATE UNIQUE INDEX IF NOT EXISTS "CustomList_slug_key" ON "CustomList"("slug");
CREATE INDEX IF NOT EXISTS "CustomListItem_listId_idx" ON "CustomListItem"("listId");
CREATE UNIQUE INDEX IF NOT EXISTS "CustomListItem_listId_tmdbId_mediaType_key"
  ON "CustomListItem"("listId", "tmdbId", "mediaType");

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'WatchSession_userId_fkey') THEN
    ALTER TABLE "WatchSession" ADD CONSTRAINT "WatchSession_userId_fkey"
      FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'WatchSession_mediaId_fkey') THEN
    ALTER TABLE "WatchSession" ADD CONSTRAINT "WatchSession_mediaId_fkey"
      FOREIGN KEY ("mediaId") REFERENCES "Media"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'Notification_userId_fkey') THEN
    ALTER TABLE "Notification" ADD CONSTRAINT "Notification_userId_fkey"
      FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'CustomList_userId_fkey') THEN
    ALTER TABLE "CustomList" ADD CONSTRAINT "CustomList_userId_fkey"
      FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'CustomListItem_listId_fkey') THEN
    ALTER TABLE "CustomListItem" ADD CONSTRAINT "CustomListItem_listId_fkey"
      FOREIGN KEY ("listId") REFERENCES "CustomList"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

-- Extend the existing fail-closed RLS policy set to all newly-migrated models.
ALTER TABLE "WatchSession" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS watch_session_isolate_own_rows ON "WatchSession";
CREATE POLICY watch_session_isolate_own_rows ON "WatchSession"
  USING ("userId" = tvtime_current_user_id())
  WITH CHECK ("userId" = tvtime_current_user_id());

ALTER TABLE "Notification" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS notification_isolate_own_rows ON "Notification";
CREATE POLICY notification_isolate_own_rows ON "Notification"
  USING ("userId" = tvtime_current_user_id())
  WITH CHECK ("userId" = tvtime_current_user_id());

ALTER TABLE "CustomList" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS custom_list_isolate_own_rows ON "CustomList";
CREATE POLICY custom_list_isolate_own_rows ON "CustomList"
  USING ("userId" = tvtime_current_user_id())
  WITH CHECK ("userId" = tvtime_current_user_id());

ALTER TABLE "CustomListItem" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS custom_list_item_isolate_own_rows ON "CustomListItem";
CREATE POLICY custom_list_item_isolate_own_rows ON "CustomListItem"
  USING (
    EXISTS (
      SELECT 1 FROM "CustomList" list
      WHERE list."id" = "CustomListItem"."listId"
        AND list."userId" = tvtime_current_user_id()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM "CustomList" list
      WHERE list."id" = "CustomListItem"."listId"
        AND list."userId" = tvtime_current_user_id()
    )
  );

COMMIT;
