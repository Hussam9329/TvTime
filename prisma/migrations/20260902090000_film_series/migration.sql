-- BAT-10: additive Film Series support. No existing rows are deleted or rewritten.
CREATE TABLE "FilmSeries" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "tmdbCollectionId" INTEGER NOT NULL,
  "name" TEXT NOT NULL,
  "posterPath" TEXT,
  "totalParts" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "FilmSeries_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "Media" ADD COLUMN "seriesId" TEXT;
ALTER TABLE "Media" ADD COLUMN "seriesPart" INTEGER;

CREATE UNIQUE INDEX "FilmSeries_userId_tmdbCollectionId_key" ON "FilmSeries"("userId", "tmdbCollectionId");
CREATE INDEX "FilmSeries_userId_idx" ON "FilmSeries"("userId");
CREATE INDEX "Media_userId_seriesId_idx" ON "Media"("userId", "seriesId");

ALTER TABLE "FilmSeries" ADD CONSTRAINT "FilmSeries_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Media" ADD CONSTRAINT "Media_seriesId_fkey"
  FOREIGN KEY ("seriesId") REFERENCES "FilmSeries"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "FilmSeries" ADD CONSTRAINT "FilmSeries_totalParts_nonnegative_check" CHECK ("totalParts" >= 0);
ALTER TABLE "Media" ADD CONSTRAINT "Media_seriesPart_positive_check" CHECK ("seriesPart" IS NULL OR "seriesPart" > 0);

ALTER TABLE "FilmSeries" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "film_series_isolate_own_rows" ON "FilmSeries"
  USING ("userId" = tvtime_current_user_id())
  WITH CHECK ("userId" = tvtime_current_user_id());
