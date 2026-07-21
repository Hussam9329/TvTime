-- TvTime core schema baseline.
--
-- New databases apply this migration first. Existing databases that were
-- originally created with `prisma db push` must NOT execute it against their
-- live tables; follow MIGRATION_BASELINE.md on a verified clone and mark this
-- baseline as applied only after the read-only inventory succeeds.

BEGIN;

CREATE TABLE "User" (
  "id" TEXT NOT NULL,
  "name" TEXT NOT NULL DEFAULT 'Cinephile',
  "avatar" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Media" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL DEFAULT 'cinetrack_default',
  "tmdbId" INTEGER,
  "title" TEXT NOT NULL,
  "originalTitle" TEXT,
  "year" TEXT,
  "type" TEXT NOT NULL,
  "poster" TEXT,
  "rating" TEXT,
  "overview" TEXT,
  "genres" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "episodes" INTEGER,
  "seasons" INTEGER,
  "duration" TEXT,
  "status" TEXT,
  "author" TEXT,
  "pages" INTEGER,
  "tags" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "notes" TEXT,
  "watched" BOOLEAN NOT NULL DEFAULT false,
  "watchedAt" TIMESTAMP(3),
  "userRating" INTEGER,
  "rewatch" BOOLEAN NOT NULL DEFAULT false,
  "runtime" INTEGER,
  "ratingStatus" TEXT,
  "isAnime" BOOLEAN NOT NULL DEFAULT false,
  "notifyOnNewEpisode" BOOLEAN,
  "rewatchCount" INTEGER NOT NULL DEFAULT 0,
  "addedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Media_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "WatchlistItem" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "mediaType" TEXT NOT NULL,
  "tmdbId" INTEGER NOT NULL,
  "title" TEXT NOT NULL,
  "posterPath" TEXT,
  "backdropPath" TEXT,
  "overview" TEXT,
  "releaseDate" TEXT,
  "voteAverage" DOUBLE PRECISION,
  "addedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "WatchlistItem_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "WatchedMovie" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "tmdbId" INTEGER NOT NULL,
  "title" TEXT NOT NULL,
  "posterPath" TEXT,
  "runtime" INTEGER,
  "watchedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "WatchedMovie_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "WatchedEpisode" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "showId" INTEGER NOT NULL,
  "seasonNumber" INTEGER NOT NULL,
  "episodeNumber" INTEGER NOT NULL,
  "episodeName" TEXT,
  "runtime" INTEGER,
  "watchedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "WatchedEpisode_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "FollowingShow" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "tmdbId" INTEGER NOT NULL,
  "title" TEXT NOT NULL,
  "posterPath" TEXT,
  "followedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "FollowingShow_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Rating" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "mediaType" TEXT NOT NULL,
  "tmdbId" INTEGER NOT NULL,
  "title" TEXT NOT NULL,
  "posterPath" TEXT,
  "value" INTEGER NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Rating_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "Media_userId_idx" ON "Media"("userId");
CREATE INDEX "Media_userId_type_idx" ON "Media"("userId", "type");
CREATE INDEX "Media_userId_status_idx" ON "Media"("userId", "status");
CREATE INDEX "Media_userId_watched_idx" ON "Media"("userId", "watched");
CREATE INDEX "Media_userId_userRating_idx" ON "Media"("userId", "userRating");
CREATE INDEX "Media_userId_isAnime_idx" ON "Media"("userId", "isAnime");
CREATE INDEX "Media_tmdbId_idx" ON "Media"("tmdbId");

CREATE UNIQUE INDEX "WatchlistItem_userId_mediaType_tmdbId_key"
  ON "WatchlistItem"("userId", "mediaType", "tmdbId");
CREATE INDEX "WatchlistItem_userId_idx" ON "WatchlistItem"("userId");

CREATE UNIQUE INDEX "WatchedMovie_userId_tmdbId_key"
  ON "WatchedMovie"("userId", "tmdbId");
CREATE INDEX "WatchedMovie_userId_idx" ON "WatchedMovie"("userId");

CREATE UNIQUE INDEX "WatchedEpisode_userId_showId_seasonNumber_episodeNumber_key"
  ON "WatchedEpisode"("userId", "showId", "seasonNumber", "episodeNumber");
CREATE INDEX "WatchedEpisode_userId_idx" ON "WatchedEpisode"("userId");
CREATE INDEX "WatchedEpisode_userId_showId_idx" ON "WatchedEpisode"("userId", "showId");

CREATE UNIQUE INDEX "FollowingShow_userId_tmdbId_key"
  ON "FollowingShow"("userId", "tmdbId");
CREATE INDEX "FollowingShow_userId_idx" ON "FollowingShow"("userId");

CREATE UNIQUE INDEX "Rating_userId_mediaType_tmdbId_key"
  ON "Rating"("userId", "mediaType", "tmdbId");
CREATE INDEX "Rating_userId_idx" ON "Rating"("userId");

ALTER TABLE "Media"
  ADD CONSTRAINT "Media_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "WatchlistItem"
  ADD CONSTRAINT "WatchlistItem_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "WatchedMovie"
  ADD CONSTRAINT "WatchedMovie_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "WatchedEpisode"
  ADD CONSTRAINT "WatchedEpisode_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "FollowingShow"
  ADD CONSTRAINT "FollowingShow_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Rating"
  ADD CONSTRAINT "Rating_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

COMMIT;
