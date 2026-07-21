-- Preserve the classification inputs required when a TV metadata cache hit is
-- later used to create or repair a Media row. Existing cache rows are marked
-- incomplete and are refreshed from TMDB before classification-sensitive use.

BEGIN;
SET LOCAL lock_timeout = '15s';
SET LOCAL statement_timeout = '5min';

ALTER TABLE "TvMetadataCache"
  ADD COLUMN IF NOT EXISTS "originalLanguage" TEXT,
  ADD COLUMN IF NOT EXISTS "originCountries" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  ADD COLUMN IF NOT EXISTS "genreIds" INTEGER[] NOT NULL DEFAULT ARRAY[]::INTEGER[],
  ADD COLUMN IF NOT EXISTS "genreNames" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  ADD COLUMN IF NOT EXISTS "classificationComplete" BOOLEAN NOT NULL DEFAULT false;

COMMIT;
