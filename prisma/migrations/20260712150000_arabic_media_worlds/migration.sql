-- Additive classification metadata for the dedicated Arabic Movies and Arabic TV worlds.
-- Existing rows remain valid and are classified safely by the explicit backfill step.
ALTER TABLE "Media"
  ADD COLUMN "isArabic" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "originalLanguage" TEXT,
  ADD COLUMN "originCountries" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];

CREATE INDEX "Media_userId_isArabic_idx" ON "Media"("userId", "isArabic");

ALTER TABLE "Media"
  ADD CONSTRAINT "Media_media_world_exclusive_check"
  CHECK (NOT ("isArabic" AND "isAnime"));
