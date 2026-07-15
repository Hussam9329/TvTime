-- Add a persistent TvMetadataCache table.
--
-- Why: src/lib/tv-status-server.ts previously used an in-memory Map for
-- caching TV show metadata (status, episode counts, next-episode info).
-- On Vercel serverless this cache is wiped on every cold start, so the
-- /api/tv-tracking endpoint re-fetches every tracked show from TMDB on
-- most requests — observed 4-6 seconds for ~599 series.
--
-- This migration adds a dedicated cache table. The application reads it
-- first, falls back to TMDB only when the row is missing or stale, then
-- upserts the fresh row. The cache is keyed by tmdbId (unique).
--
-- Rollback:
--   DROP TABLE IF EXISTS "TvMetadataCache";
-- (safe — no other table references it; the application falls back to
-- TMDB directly when the table is absent)

CREATE TABLE IF NOT EXISTS "TvMetadataCache" (
  "tmdbId"                    INTEGER      NOT NULL,
  "title"                     TEXT         NOT NULL,
  "posterPath"                TEXT,
  "overview"                  TEXT,
  "firstAirDate"              TEXT,
  "tmdbStatus"                TEXT,
  "officiallyEnded"           BOOLEAN      NOT NULL,
  "inProduction"              BOOLEAN,
  "totalEpisodes"             INTEGER,
  "totalSeasons"              INTEGER,
  "airedEpisodeCount"         INTEGER,
  "airedEpisodeKeys"          TEXT[]       NOT NULL DEFAULT '{}',
  "airedEpisodeInferenceReliable" BOOLEAN  NOT NULL DEFAULT FALSE,
  "nextEpisodeAirDate"        TEXT,
  "nextEpisodeName"           TEXT,
  "nextEpisodeSeasonNumber"   INTEGER,
  "nextEpisodeEpisodeNumber"  INTEGER,
  "seasonsCount"              INTEGER,
  "lastSeasonNumber"          INTEGER,
  "fetchedAt"                 TIMESTAMP    NOT NULL DEFAULT NOW(),
  "refreshAfter"              TIMESTAMP    NOT NULL,

  CONSTRAINT "TvMetadataCache_pkey" PRIMARY KEY ("tmdbId")
);

CREATE INDEX IF NOT EXISTS "TvMetadataCache_refreshAfter_idx"
  ON "TvMetadataCache" ("refreshAfter");

COMMENT ON TABLE "TvMetadataCache" IS
  'Persistent server-side cache of TV show metadata from TMDB. Reduces /api/tv-tracking latency from ~5s to ~500ms by avoiding per-request TMDB calls.';
