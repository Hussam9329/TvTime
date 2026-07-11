-- Enforce one canonical TMDB-backed Media row per user and media type.
-- This migration intentionally leaves rows with tmdbId IS NULL unaffected because
-- PostgreSQL UNIQUE constraints allow multiple NULL identities.

BEGIN;

-- Fail instead of waiting indefinitely if production is not in the agreed maintenance window.
SET LOCAL lock_timeout = '15s';
SET LOCAL statement_timeout = '15min';

-- Block concurrent Media writes only for the short backfill/deduplication/constraint window.
LOCK TABLE "Media" IN SHARE ROW EXCLUSIVE MODE;

-- Membership is independent from episode progress. Existing installations used
-- active TV status values as the membership signal, so preserve that behavior
-- once while introducing the dedicated field.
ALTER TABLE "Media"
  ADD COLUMN "isFollowing" BOOLEAN NOT NULL DEFAULT false;

-- Canonicalize the historical TV alias before duplicate grouping so a
-- user cannot retain both type='tv' and type='series' for the same TMDB show.
UPDATE "Media"
SET "type" = 'series'
WHERE "type" = 'tv';

UPDATE "Media"
SET "isFollowing" = true
WHERE "type" = 'series'
  AND "status" IN ('not_started', 'watching', 'uptodate', 'finished');

CREATE TEMP TABLE "_MediaDedup" ON COMMIT DROP AS
WITH ranked AS (
  SELECT
    m.*,
    (
      (CASE WHEN m."watched" THEN 1000 ELSE 0 END) +
      (CASE WHEN m."userRating" IS NOT NULL THEN 500 ELSE 0 END) +
      (CASE WHEN m."status" IS NOT NULL THEN 300 ELSE 0 END) +
      (CASE WHEN m."watchedAt" IS NOT NULL THEN 150 ELSE 0 END) +
      (CASE WHEN m."poster" IS NOT NULL THEN 40 ELSE 0 END) +
      (CASE WHEN m."overview" IS NOT NULL THEN 30 ELSE 0 END) +
      (CASE WHEN m."notes" IS NOT NULL AND btrim(m."notes") <> '' THEN 25 ELSE 0 END) +
      LEAST(COALESCE(cardinality(m."genres"), 0), 20) +
      LEAST(COALESCE(cardinality(m."tags"), 0), 20)
    ) AS completeness_score,
    first_value(m."id") OVER (
      PARTITION BY m."userId", m."type", m."tmdbId"
      ORDER BY
        m."watched" DESC,
        (m."userRating" IS NOT NULL) DESC,
        (m."status" IS NOT NULL) DESC,
        (
          (CASE WHEN m."poster" IS NOT NULL THEN 1 ELSE 0 END) +
          (CASE WHEN m."overview" IS NOT NULL THEN 1 ELSE 0 END) +
          (CASE WHEN m."notes" IS NOT NULL AND btrim(m."notes") <> '' THEN 1 ELSE 0 END)
        ) DESC,
        m."updatedAt" DESC,
        m."id"
    ) AS keep_id
  FROM "Media" m
  WHERE m."tmdbId" IS NOT NULL
)
SELECT
  r."userId",
  r."type",
  r."tmdbId",
  r.keep_id,
  bool_or(r."watched") AS watched,
  bool_or(r."rewatch") AS rewatch,
  bool_or(r."isAnime") AS "isAnime",
  bool_or(r."isFollowing") AS "isFollowing",
  (array_agg(r."userRating" ORDER BY r."updatedAt" DESC) FILTER (WHERE r."userRating" IS NOT NULL))[1] AS "userRating",
  max(r."watchedAt") AS "watchedAt",
  min(r."addedAt") AS "addedAt",
  (
    array_agg(
      r."status"
      ORDER BY
        CASE r."status"
          WHEN 'finished' THEN 60
          WHEN 'watched' THEN 60
          WHEN 'uptodate' THEN 50
          WHEN 'watching' THEN 40
          WHEN 'not_started' THEN 30
          WHEN 'planned' THEN 20
          ELSE 10
        END DESC,
        r."updatedAt" DESC
    ) FILTER (WHERE r."status" IS NOT NULL)
  )[1] AS status,
  (array_agg(r."title" ORDER BY r.completeness_score DESC, r."updatedAt" DESC) FILTER (WHERE btrim(r."title") <> ''))[1] AS title,
  (array_agg(r."originalTitle" ORDER BY r.completeness_score DESC, r."updatedAt" DESC) FILTER (WHERE r."originalTitle" IS NOT NULL))[1] AS "originalTitle",
  (array_agg(r."year" ORDER BY r.completeness_score DESC, r."updatedAt" DESC) FILTER (WHERE r."year" IS NOT NULL))[1] AS year,
  (array_agg(r."poster" ORDER BY r.completeness_score DESC, r."updatedAt" DESC) FILTER (WHERE r."poster" IS NOT NULL))[1] AS poster,
  (array_agg(r."rating" ORDER BY r.completeness_score DESC, r."updatedAt" DESC) FILTER (WHERE r."rating" IS NOT NULL))[1] AS rating,
  (array_agg(r."overview" ORDER BY r.completeness_score DESC, r."updatedAt" DESC) FILTER (WHERE r."overview" IS NOT NULL))[1] AS overview,
  (array_agg(r."episodes" ORDER BY r.completeness_score DESC, r."updatedAt" DESC) FILTER (WHERE r."episodes" IS NOT NULL))[1] AS episodes,
  (array_agg(r."seasons" ORDER BY r.completeness_score DESC, r."updatedAt" DESC) FILTER (WHERE r."seasons" IS NOT NULL))[1] AS seasons,
  (array_agg(r."duration" ORDER BY r.completeness_score DESC, r."updatedAt" DESC) FILTER (WHERE r."duration" IS NOT NULL))[1] AS duration,
  (array_agg(r."author" ORDER BY r.completeness_score DESC, r."updatedAt" DESC) FILTER (WHERE r."author" IS NOT NULL))[1] AS author,
  (array_agg(r."pages" ORDER BY r.completeness_score DESC, r."updatedAt" DESC) FILTER (WHERE r."pages" IS NOT NULL))[1] AS pages,
  (array_agg(r."runtime" ORDER BY r.completeness_score DESC, r."updatedAt" DESC) FILTER (WHERE r."runtime" IS NOT NULL))[1] AS runtime,
  (array_agg(r."ratingStatus" ORDER BY r.completeness_score DESC, r."updatedAt" DESC) FILTER (WHERE r."ratingStatus" IS NOT NULL))[1] AS "ratingStatus"
FROM ranked r
GROUP BY r."userId", r."type", r."tmdbId", r.keep_id
HAVING count(*) > 1;

-- Merge state and the best available scalar metadata into the canonical row.
UPDATE "Media" keep
SET
  "watched" = d.watched,
  "rewatch" = d.rewatch,
  "isAnime" = d."isAnime",
  "isFollowing" = d."isFollowing",
  "userRating" = d."userRating",
  "watchedAt" = d."watchedAt",
  "addedAt" = d."addedAt",
  "status" = d.status,
  "title" = COALESCE(d.title, keep."title"),
  "originalTitle" = COALESCE(keep."originalTitle", d."originalTitle"),
  "year" = COALESCE(keep."year", d.year),
  "poster" = COALESCE(keep."poster", d.poster),
  "rating" = COALESCE(keep."rating", d.rating),
  "overview" = COALESCE(keep."overview", d.overview),
  "episodes" = COALESCE(keep."episodes", d.episodes),
  "seasons" = COALESCE(keep."seasons", d.seasons),
  "duration" = COALESCE(keep."duration", d.duration),
  "author" = COALESCE(keep."author", d.author),
  "pages" = COALESCE(keep."pages", d.pages),
  "runtime" = COALESCE(keep."runtime", d.runtime),
  "ratingStatus" = COALESCE(keep."ratingStatus", d."ratingStatus")
FROM "_MediaDedup" d
WHERE keep."id" = d.keep_id;

-- Preserve every distinct genre/tag from duplicate rows.
UPDATE "Media" keep
SET "genres" = merged.genres
FROM (
  SELECT
    d.keep_id,
    array_agg(DISTINCT genre ORDER BY genre) AS genres
  FROM "_MediaDedup" d
  JOIN "Media" m
    ON m."userId" = d."userId" AND m."type" = d."type" AND m."tmdbId" = d."tmdbId"
  CROSS JOIN LATERAL unnest(m."genres") AS genre
  GROUP BY d.keep_id
) merged
WHERE keep."id" = merged.keep_id;

UPDATE "Media" keep
SET "tags" = merged.tags
FROM (
  SELECT
    d.keep_id,
    array_agg(DISTINCT tag ORDER BY tag) AS tags
  FROM "_MediaDedup" d
  JOIN "Media" m
    ON m."userId" = d."userId" AND m."type" = d."type" AND m."tmdbId" = d."tmdbId"
  CROSS JOIN LATERAL unnest(m."tags") AS tag
  GROUP BY d.keep_id
) merged
WHERE keep."id" = merged.keep_id;

-- Preserve distinct notes rather than silently discarding text from a duplicate.
UPDATE "Media" keep
SET "notes" = merged.notes
FROM (
  SELECT
    d.keep_id,
    string_agg(DISTINCT NULLIF(btrim(m."notes"), ''), E'\n\n') AS notes
  FROM "_MediaDedup" d
  JOIN "Media" m
    ON m."userId" = d."userId" AND m."type" = d."type" AND m."tmdbId" = d."tmdbId"
  GROUP BY d.keep_id
) merged
WHERE keep."id" = merged.keep_id AND merged.notes IS NOT NULL;

DELETE FROM "Media" duplicate
USING "_MediaDedup" d
WHERE duplicate."userId" = d."userId"
  AND duplicate."type" = d."type"
  AND duplicate."tmdbId" = d."tmdbId"
  AND duplicate."id" <> d.keep_id;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM "Media"
    WHERE "tmdbId" IS NOT NULL
    GROUP BY "userId", "type", "tmdbId"
    HAVING count(*) > 1
  ) THEN
    RAISE EXCEPTION 'Media deduplication verification failed; unique constraint was not applied';
  END IF;
END $$;

ALTER TABLE "Media"
  ADD CONSTRAINT "Media_userId_type_tmdbId_key"
  UNIQUE ("userId", "type", "tmdbId");

COMMIT;
