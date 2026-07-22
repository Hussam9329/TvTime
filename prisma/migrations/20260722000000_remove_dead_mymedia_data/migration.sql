-- Remove unsupported MyMedia-era records and fields.
DELETE FROM "Media" WHERE type NOT IN ('movie', 'series');

ALTER TABLE "Media"
  DROP COLUMN IF EXISTS author,
  DROP COLUMN IF EXISTS pages;

DO $$ BEGIN
  ALTER TABLE "Media" ADD CONSTRAINT "Media_type_supported_check"
    CHECK (type IN ('movie', 'series'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
