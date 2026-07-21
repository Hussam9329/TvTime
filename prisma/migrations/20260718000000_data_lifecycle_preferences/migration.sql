-- Patch 09: synchronize user preferences and enforce new-write domain invariants.

ALTER TABLE "User"
  ADD COLUMN IF NOT EXISTS "timezone" TEXT NOT NULL DEFAULT 'Asia/Baghdad',
  ADD COLUMN IF NOT EXISTS "country" TEXT NOT NULL DEFAULT 'IQ',
  ADD COLUMN IF NOT EXISTS "preferredPlatforms" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];

-- NOT VALID keeps legacy production rows deployable while protecting every new
-- or updated row. A reviewed cleanup can validate these constraints later.
DO $$ BEGIN
  ALTER TABLE "User" ADD CONSTRAINT "User_country_format_check"
    CHECK ("country" ~ '^[A-Z]{2}$') NOT VALID;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "Media" ADD CONSTRAINT "Media_userRating_range_check"
    CHECK ("userRating" IS NULL OR ("userRating" >= 0 AND "userRating" <= 100)) NOT VALID;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "Media" ADD CONSTRAINT "Media_rewatchCount_nonnegative_check"
    CHECK ("rewatchCount" >= 0) NOT VALID;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "Rating" ADD CONSTRAINT "Rating_value_range_check"
    CHECK (value >= 0 AND value <= 100) NOT VALID;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "WatchedEpisode" ADD CONSTRAINT "WatchedEpisode_numbers_check"
    CHECK ("seasonNumber" >= 0 AND "episodeNumber" > 0 AND (runtime IS NULL OR runtime >= 0)) NOT VALID;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "WatchSession" ADD CONSTRAINT "WatchSession_values_check"
    CHECK (
      (season IS NULL OR season >= 0) AND
      (episode IS NULL OR episode > 0) AND
      (duration IS NULL OR duration >= 0) AND
      (rating IS NULL OR (rating >= 0 AND rating <= 100))
    ) NOT VALID;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "CustomListItem" ADD CONSTRAINT "CustomListItem_order_nonnegative_check"
    CHECK ("order" >= 0) NOT VALID;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
