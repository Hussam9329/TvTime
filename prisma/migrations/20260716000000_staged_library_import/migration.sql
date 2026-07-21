-- Staged, validated and atomically committed library imports.

BEGIN;
SET LOCAL lock_timeout = '15s';
SET LOCAL statement_timeout = '10min';

CREATE TABLE "LibraryImportSession" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "version" INTEGER NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'uploading',
  "manifest" JSONB NOT NULL,
  "expectedRecords" INTEGER NOT NULL,
  "receivedRecords" INTEGER NOT NULL DEFAULT 0,
  "expectedChunks" INTEGER,
  "receivedChunks" INTEGER NOT NULL DEFAULT 0,
  "preview" JSONB,
  "result" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "committedAt" TIMESTAMP(3),
  CONSTRAINT "LibraryImportSession_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "LibraryImportSession_status_check"
    CHECK ("status" IN ('uploading', 'ready', 'committing', 'committed', 'aborted', 'failed')),
  CONSTRAINT "LibraryImportSession_expectedRecords_check" CHECK ("expectedRecords" >= 0),
  CONSTRAINT "LibraryImportSession_receivedRecords_check" CHECK ("receivedRecords" >= 0),
  CONSTRAINT "LibraryImportSession_receivedChunks_check" CHECK ("receivedChunks" >= 0)
);

CREATE TABLE "LibraryImportChunk" (
  "id" TEXT NOT NULL,
  "sessionId" TEXT NOT NULL,
  "sequence" INTEGER NOT NULL,
  "checksum" TEXT NOT NULL,
  "recordCount" INTEGER NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "LibraryImportChunk_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "LibraryImportChunk_sequence_check" CHECK ("sequence" >= 0),
  CONSTRAINT "LibraryImportChunk_recordCount_check" CHECK ("recordCount" > 0)
);

CREATE TABLE "LibraryImportRecord" (
  "id" TEXT NOT NULL,
  "sessionId" TEXT NOT NULL,
  "collection" TEXT NOT NULL,
  "ordinal" INTEGER NOT NULL,
  "payload" JSONB NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "LibraryImportRecord_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "LibraryImportRecord_collection_check"
    CHECK ("collection" IN ('media', 'watchedEpisodes', 'episodeRatings')),
  CONSTRAINT "LibraryImportRecord_ordinal_check" CHECK ("ordinal" >= 0)
);

CREATE INDEX "LibraryImportSession_userId_status_idx"
  ON "LibraryImportSession"("userId", "status");
CREATE INDEX "LibraryImportSession_expiresAt_idx"
  ON "LibraryImportSession"("expiresAt");
CREATE UNIQUE INDEX "LibraryImportChunk_sessionId_sequence_key"
  ON "LibraryImportChunk"("sessionId", "sequence");
CREATE INDEX "LibraryImportChunk_sessionId_idx"
  ON "LibraryImportChunk"("sessionId");
CREATE UNIQUE INDEX "LibraryImportRecord_sessionId_collection_ordinal_key"
  ON "LibraryImportRecord"("sessionId", "collection", "ordinal");
CREATE INDEX "LibraryImportRecord_sessionId_collection_idx"
  ON "LibraryImportRecord"("sessionId", "collection");

ALTER TABLE "LibraryImportSession"
  ADD CONSTRAINT "LibraryImportSession_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "LibraryImportChunk"
  ADD CONSTRAINT "LibraryImportChunk_sessionId_fkey"
  FOREIGN KEY ("sessionId") REFERENCES "LibraryImportSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "LibraryImportRecord"
  ADD CONSTRAINT "LibraryImportRecord_sessionId_fkey"
  FOREIGN KEY ("sessionId") REFERENCES "LibraryImportSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "LibraryImportSession" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS library_import_session_isolate_own_rows ON "LibraryImportSession";
CREATE POLICY library_import_session_isolate_own_rows ON "LibraryImportSession"
  USING ("userId" = tvtime_current_user_id())
  WITH CHECK ("userId" = tvtime_current_user_id());

ALTER TABLE "LibraryImportChunk" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS library_import_chunk_isolate_own_rows ON "LibraryImportChunk";
CREATE POLICY library_import_chunk_isolate_own_rows ON "LibraryImportChunk"
  USING (
    EXISTS (
      SELECT 1 FROM "LibraryImportSession" session
      WHERE session."id" = "LibraryImportChunk"."sessionId"
        AND session."userId" = tvtime_current_user_id()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM "LibraryImportSession" session
      WHERE session."id" = "LibraryImportChunk"."sessionId"
        AND session."userId" = tvtime_current_user_id()
    )
  );

ALTER TABLE "LibraryImportRecord" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS library_import_record_isolate_own_rows ON "LibraryImportRecord";
CREATE POLICY library_import_record_isolate_own_rows ON "LibraryImportRecord"
  USING (
    EXISTS (
      SELECT 1 FROM "LibraryImportSession" session
      WHERE session."id" = "LibraryImportRecord"."sessionId"
        AND session."userId" = tvtime_current_user_id()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM "LibraryImportSession" session
      WHERE session."id" = "LibraryImportRecord"."sessionId"
        AND session."userId" = tvtime_current_user_id()
    )
  );

COMMIT;
