import type { Prisma } from "@prisma/client";

export type LibraryImportCommitResult = {
  mediaRowsAffected: number;
  watchedEpisodeRowsAffected: number;
  episodeRatingRowsAffected: number;
  seriesProgressRowsAffected: number;
  watchSessionRowsAffected: number;
  notificationRowsAffected: number;
  preferencesUpdated: boolean;
};

function asPayload(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  return value as Record<string, unknown>;
}

/**
 * Merge normalized staging rows into the canonical tables. The caller owns the
 * surrounding interactive transaction, so either every target table and the
 * import-session state commit together or none of them do.
 */
export async function commitStagedLibraryImport(
  tx: Prisma.TransactionClient,
  sessionId: string,
  userId: string,
): Promise<LibraryImportCommitResult> {
  const mediaWithIdentity = await tx.$executeRaw`
    WITH staged_raw AS (
      SELECT
        record.ordinal,
        record.payload->>'importId' AS id,
        NULLIF(record.payload->>'tmdbId', '')::INTEGER AS "tmdbId",
        record.payload->>'title' AS title,
        NULLIF(record.payload->>'originalTitle', '') AS "originalTitle",
        NULLIF(record.payload->>'year', '') AS year,
        record.payload->>'type' AS type,
        NULLIF(record.payload->>'poster', '') AS poster,
        NULLIF(record.payload->>'rating', '') AS rating,
        NULLIF(record.payload->>'overview', '') AS overview,
        ARRAY(SELECT jsonb_array_elements_text(COALESCE(record.payload->'genres', '[]'::jsonb))) AS genres,
        NULLIF(record.payload->>'episodes', '')::INTEGER AS episodes,
        NULLIF(record.payload->>'seasons', '')::INTEGER AS seasons,
        NULLIF(record.payload->>'duration', '') AS duration,
        NULLIF(record.payload->>'status', '') AS status,
        ARRAY(SELECT jsonb_array_elements_text(COALESCE(record.payload->'tags', '[]'::jsonb))) AS tags,
        NULLIF(record.payload->>'notes', '') AS notes,
        COALESCE((record.payload->>'watched')::BOOLEAN, false) AS watched,
        CASE WHEN NULLIF(record.payload->>'watchedAt', '') IS NULL THEN NULL ELSE (record.payload->>'watchedAt')::TIMESTAMPTZ END AS "watchedAt",
        NULLIF(record.payload->>'userRating', '')::INTEGER AS "userRating",
        COALESCE((record.payload->>'rewatch')::BOOLEAN, false) AS rewatch,
        NULLIF(record.payload->>'runtime', '')::INTEGER AS runtime,
        NULLIF(record.payload->>'ratingStatus', '') AS "ratingStatus",
        COALESCE((record.payload->>'isAnime')::BOOLEAN, false) AS "isAnime",
        COALESCE((record.payload->>'isArabic')::BOOLEAN, false) AS "isArabic",
        NULLIF(record.payload->>'originalLanguage', '') AS "originalLanguage",
        ARRAY(SELECT jsonb_array_elements_text(COALESCE(record.payload->'originCountries', '[]'::jsonb))) AS "originCountries",
        COALESCE((record.payload->>'isFollowing')::BOOLEAN, false) AS "isFollowing",
        CASE WHEN record.payload->>'notifyOnNewEpisode' IS NULL THEN NULL ELSE (record.payload->>'notifyOnNewEpisode')::BOOLEAN END AS "notifyOnNewEpisode",
        COALESCE(NULLIF(record.payload->>'rewatchCount', '')::INTEGER, 0) AS "rewatchCount",
        CASE WHEN NULLIF(record.payload->>'addedAt', '') IS NULL THEN NOW() ELSE (record.payload->>'addedAt')::TIMESTAMPTZ END AS "addedAt"
      FROM "LibraryImportRecord" record
      WHERE record."sessionId" = ${sessionId}
        AND record.collection = 'media'
        AND NULLIF(record.payload->>'tmdbId', '') IS NOT NULL
    ), staged AS (
      SELECT *, row_number() OVER (
        PARTITION BY type, "tmdbId"
        ORDER BY ordinal
      ) AS duplicate_rank
      FROM staged_raw
    )
    INSERT INTO "Media" (
      id, "userId", "tmdbId", title, "originalTitle", year, type, poster, rating,
      overview, genres, episodes, seasons, duration, status, tags,
      notes, watched, "watchedAt", "userRating", rewatch, runtime, "ratingStatus",
      "isAnime", "isArabic", "originalLanguage", "originCountries", "isFollowing",
      "notifyOnNewEpisode", "rewatchCount", "addedAt", "updatedAt"
    )
    SELECT
      id, ${userId}, "tmdbId", title, "originalTitle", year, type, poster, rating,
      overview, genres, episodes, seasons, duration, status, tags,
      notes, watched, "watchedAt", "userRating", rewatch, runtime, "ratingStatus",
      "isAnime", "isArabic", "originalLanguage", "originCountries", "isFollowing",
      "notifyOnNewEpisode", "rewatchCount", "addedAt", NOW()
    FROM staged
    WHERE duplicate_rank = 1
    ON CONFLICT ("userId", "type", "tmdbId") DO UPDATE SET
      title = CASE WHEN btrim("Media".title) = '' THEN EXCLUDED.title ELSE "Media".title END,
      "originalTitle" = COALESCE("Media"."originalTitle", EXCLUDED."originalTitle"),
      year = COALESCE("Media".year, EXCLUDED.year),
      poster = COALESCE("Media".poster, EXCLUDED.poster),
      rating = COALESCE("Media".rating, EXCLUDED.rating),
      overview = COALESCE("Media".overview, EXCLUDED.overview),
      genres = CASE WHEN cardinality("Media".genres) = 0 THEN EXCLUDED.genres ELSE "Media".genres END,
      episodes = COALESCE("Media".episodes, EXCLUDED.episodes),
      seasons = COALESCE("Media".seasons, EXCLUDED.seasons),
      duration = COALESCE("Media".duration, EXCLUDED.duration),
      status = CASE
        WHEN EXCLUDED.watched AND "Media".type <> 'series' THEN COALESCE(EXCLUDED.status, 'watched')
        ELSE COALESCE("Media".status, EXCLUDED.status)
      END,
      tags = CASE WHEN cardinality("Media".tags) = 0 THEN EXCLUDED.tags ELSE "Media".tags END,
      notes = COALESCE("Media".notes, EXCLUDED.notes),
      watched = "Media".watched OR EXCLUDED.watched,
      "watchedAt" = GREATEST("Media"."watchedAt", EXCLUDED."watchedAt"),
      "userRating" = COALESCE("Media"."userRating", EXCLUDED."userRating"),
      rewatch = "Media".rewatch OR EXCLUDED.rewatch,
      runtime = COALESCE("Media".runtime, EXCLUDED.runtime),
      "ratingStatus" = COALESCE("Media"."ratingStatus", EXCLUDED."ratingStatus"),
      "isArabic" = "Media"."isArabic" OR EXCLUDED."isArabic",
      "isAnime" = CASE
        WHEN "Media"."isArabic" OR EXCLUDED."isArabic" THEN false
        ELSE "Media"."isAnime" OR EXCLUDED."isAnime"
      END,
      "originalLanguage" = COALESCE("Media"."originalLanguage", EXCLUDED."originalLanguage"),
      "originCountries" = CASE
        WHEN cardinality("Media"."originCountries") = 0 THEN EXCLUDED."originCountries"
        ELSE "Media"."originCountries"
      END,
      "isFollowing" = "Media"."isFollowing" OR EXCLUDED."isFollowing",
      "notifyOnNewEpisode" = COALESCE("Media"."notifyOnNewEpisode", EXCLUDED."notifyOnNewEpisode"),
      "rewatchCount" = GREATEST("Media"."rewatchCount", EXCLUDED."rewatchCount"),
      "addedAt" = LEAST("Media"."addedAt", EXCLUDED."addedAt"),
      "updatedAt" = NOW()
  `;

  const mediaWithoutIdentity = await tx.$executeRaw`
    WITH staged AS (
      SELECT
        record.ordinal,
        record.payload,
        row_number() OVER (
          PARTITION BY lower(record.payload->>'title'), record.payload->>'type'
          ORDER BY record.ordinal
        ) AS duplicate_rank
      FROM "LibraryImportRecord" record
      WHERE record."sessionId" = ${sessionId}
        AND record.collection = 'media'
        AND NULLIF(record.payload->>'tmdbId', '') IS NULL
    )
    INSERT INTO "Media" (
      id, "userId", "tmdbId", title, "originalTitle", year, type, poster, rating,
      overview, genres, episodes, seasons, duration, status, tags,
      notes, watched, "watchedAt", "userRating", rewatch, runtime, "ratingStatus",
      "isAnime", "isArabic", "originalLanguage", "originCountries", "isFollowing",
      "notifyOnNewEpisode", "rewatchCount", "addedAt", "updatedAt"
    )
    SELECT
      payload->>'importId',
      ${userId},
      NULL,
      payload->>'title',
      NULLIF(payload->>'originalTitle', ''),
      NULLIF(payload->>'year', ''),
      payload->>'type',
      NULLIF(payload->>'poster', ''),
      NULLIF(payload->>'rating', ''),
      NULLIF(payload->>'overview', ''),
      ARRAY(SELECT jsonb_array_elements_text(COALESCE(payload->'genres', '[]'::jsonb))),
      NULLIF(payload->>'episodes', '')::INTEGER,
      NULLIF(payload->>'seasons', '')::INTEGER,
      NULLIF(payload->>'duration', ''),
      NULLIF(payload->>'status', ''),
      ARRAY(SELECT jsonb_array_elements_text(COALESCE(payload->'tags', '[]'::jsonb))),
      NULLIF(payload->>'notes', ''),
      COALESCE((payload->>'watched')::BOOLEAN, false),
      CASE WHEN NULLIF(payload->>'watchedAt', '') IS NULL THEN NULL ELSE (payload->>'watchedAt')::TIMESTAMPTZ END,
      NULLIF(payload->>'userRating', '')::INTEGER,
      COALESCE((payload->>'rewatch')::BOOLEAN, false),
      NULLIF(payload->>'runtime', '')::INTEGER,
      NULLIF(payload->>'ratingStatus', ''),
      COALESCE((payload->>'isAnime')::BOOLEAN, false),
      COALESCE((payload->>'isArabic')::BOOLEAN, false),
      NULLIF(payload->>'originalLanguage', ''),
      ARRAY(SELECT jsonb_array_elements_text(COALESCE(payload->'originCountries', '[]'::jsonb))),
      COALESCE((payload->>'isFollowing')::BOOLEAN, false),
      CASE WHEN payload->>'notifyOnNewEpisode' IS NULL THEN NULL ELSE (payload->>'notifyOnNewEpisode')::BOOLEAN END,
      COALESCE(NULLIF(payload->>'rewatchCount', '')::INTEGER, 0),
      CASE WHEN NULLIF(payload->>'addedAt', '') IS NULL THEN NOW() ELSE (payload->>'addedAt')::TIMESTAMPTZ END,
      NOW()
    FROM staged
    WHERE duplicate_rank = 1
      AND NOT EXISTS (
        SELECT 1 FROM "Media" existing
        WHERE existing."userId" = ${userId}
          AND existing.type = staged.payload->>'type'
          AND lower(existing.title) = lower(staged.payload->>'title')
      )
  `;

  const watchedEpisodeRowsAffected = await tx.$executeRaw`
    WITH staged AS (
      SELECT
        record.payload,
        row_number() OVER (
          PARTITION BY
            (record.payload->>'showId')::INTEGER,
            (record.payload->>'seasonNumber')::INTEGER,
            (record.payload->>'episodeNumber')::INTEGER
          ORDER BY record.ordinal
        ) AS duplicate_rank
      FROM "LibraryImportRecord" record
      WHERE record."sessionId" = ${sessionId}
        AND record.collection = 'watchedEpisodes'
    )
    INSERT INTO "WatchedEpisode" (
      id, "userId", "showId", "seasonNumber", "episodeNumber", "episodeName", runtime, "watchedAt"
    )
    SELECT
      payload->>'importId',
      ${userId},
      (payload->>'showId')::INTEGER,
      (payload->>'seasonNumber')::INTEGER,
      (payload->>'episodeNumber')::INTEGER,
      NULLIF(payload->>'episodeName', ''),
      NULLIF(payload->>'runtime', '')::INTEGER,
      CASE WHEN NULLIF(payload->>'watchedAt', '') IS NULL THEN NOW() ELSE (payload->>'watchedAt')::TIMESTAMPTZ END
    FROM staged
    WHERE duplicate_rank = 1
    ON CONFLICT ("userId", "showId", "seasonNumber", "episodeNumber") DO UPDATE SET
      "episodeName" = COALESCE("WatchedEpisode"."episodeName", EXCLUDED."episodeName"),
      runtime = COALESCE("WatchedEpisode".runtime, EXCLUDED.runtime),
      "watchedAt" = LEAST("WatchedEpisode"."watchedAt", EXCLUDED."watchedAt")
  `;

  const episodeRatingRowsAffected = await tx.$executeRaw`
    WITH staged AS (
      SELECT
        record.payload,
        row_number() OVER (
          PARTITION BY record.payload->>'mediaType', (record.payload->>'tmdbId')::INTEGER
          ORDER BY record.ordinal DESC
        ) AS duplicate_rank
      FROM "LibraryImportRecord" record
      WHERE record."sessionId" = ${sessionId}
        AND record.collection = 'episodeRatings'
    )
    INSERT INTO "Rating" (
      id, "userId", "mediaType", "tmdbId", title, "posterPath", value, "createdAt", "updatedAt"
    )
    SELECT
      staged.payload->>'importId',
      ${userId},
      staged.payload->>'mediaType',
      (staged.payload->>'tmdbId')::INTEGER,
      staged.payload->>'title',
      NULLIF(staged.payload->>'posterPath', ''),
      (staged.payload->>'value')::INTEGER,
      CASE WHEN NULLIF(staged.payload->>'createdAt', '') IS NULL THEN NOW() ELSE (staged.payload->>'createdAt')::TIMESTAMPTZ END,
      CASE WHEN NULLIF(staged.payload->>'updatedAt', '') IS NULL THEN NOW() ELSE (staged.payload->>'updatedAt')::TIMESTAMPTZ END
    FROM staged
    WHERE staged.duplicate_rank = 1
      AND EXISTS (
        SELECT 1 FROM "WatchedEpisode" watched
        WHERE watched."userId" = ${userId}
          AND watched."showId" = (staged.payload->>'tmdbId')::INTEGER
          AND watched."seasonNumber" = (staged.payload->>'seasonNumber')::INTEGER
          AND watched."episodeNumber" = (staged.payload->>'episodeNumber')::INTEGER
      )
    ON CONFLICT ("userId", "mediaType", "tmdbId") DO UPDATE SET
      title = EXCLUDED.title,
      "posterPath" = COALESCE(EXCLUDED."posterPath", "Rating"."posterPath"),
      value = EXCLUDED.value,
      "updatedAt" = GREATEST("Rating"."updatedAt", EXCLUDED."updatedAt")
  `;

  const seriesProgressRowsAffected = await tx.$executeRaw`
    WITH progress AS (
      SELECT "showId", MAX("watchedAt") AS "lastWatchedAt"
      FROM "WatchedEpisode"
      WHERE "userId" = ${userId}
      GROUP BY "showId"
    )
    UPDATE "Media" media
    SET
      status = CASE WHEN media.status = 'planned' THEN 'watching' ELSE COALESCE(media.status, 'watching') END,
      watched = false,
      "watchedAt" = progress."lastWatchedAt",
      "updatedAt" = NOW()
    FROM progress
    WHERE media."userId" = ${userId}
      AND media.type = 'series'
      AND media."tmdbId" = progress."showId"
  `;

  const watchSessionRowsAffected = await tx.$executeRaw`
    WITH staged AS (
      SELECT record.payload
      FROM "LibraryImportRecord" record
      WHERE record."sessionId" = ${sessionId}
        AND record.collection = 'watchSessions'
    )
    INSERT INTO "WatchSession" (
      id, "userId", "mediaId", "mediaType", "tmdbId", title, season, episode,
      "watchedAt", duration, rewatch, rating, source, notes, "createdAt"
    )
    SELECT
      payload->>'importId', ${userId}, NULL, payload->>'mediaType',
      (payload->>'tmdbId')::INTEGER, payload->>'title',
      NULLIF(payload->>'season', '')::INTEGER, NULLIF(payload->>'episode', '')::INTEGER,
      COALESCE(NULLIF(payload->>'watchedAt', '')::TIMESTAMPTZ, NOW()),
      NULLIF(payload->>'duration', '')::INTEGER,
      COALESCE((payload->>'rewatch')::BOOLEAN, false),
      NULLIF(payload->>'rating', '')::INTEGER, NULLIF(payload->>'source', ''),
      NULLIF(payload->>'notes', ''),
      COALESCE(NULLIF(payload->>'createdAt', '')::TIMESTAMPTZ, NOW())
    FROM staged
    WHERE NOT EXISTS (
      SELECT 1 FROM "WatchSession" existing
      WHERE existing."userId" = ${userId}
        AND existing."mediaType" = staged.payload->>'mediaType'
        AND existing."tmdbId" = (staged.payload->>'tmdbId')::INTEGER
        AND COALESCE(existing.season, -1) = COALESCE(NULLIF(staged.payload->>'season', '')::INTEGER, -1)
        AND COALESCE(existing.episode, -1) = COALESCE(NULLIF(staged.payload->>'episode', '')::INTEGER, -1)
        AND existing."watchedAt" = COALESCE(NULLIF(staged.payload->>'watchedAt', '')::TIMESTAMPTZ, NOW())
    )
  `;

  const notificationRowsAffected = await tx.$executeRaw`
    WITH staged AS (
      SELECT record.payload
      FROM "LibraryImportRecord" record
      WHERE record."sessionId" = ${sessionId}
        AND record.collection = 'notifications'
    )
    INSERT INTO "Notification" (
      id, "userId", type, title, body, "tmdbId", "mediaType", read, "scheduledFor", "createdAt"
    )
    SELECT
      payload->>'importId', ${userId}, payload->>'type', payload->>'title', payload->>'body',
      NULLIF(payload->>'tmdbId', '')::INTEGER, NULLIF(payload->>'mediaType', ''),
      COALESCE((payload->>'read')::BOOLEAN, false),
      NULLIF(payload->>'scheduledFor', '')::TIMESTAMPTZ,
      COALESCE(NULLIF(payload->>'createdAt', '')::TIMESTAMPTZ, NOW())
    FROM staged
    WHERE NOT EXISTS (
      SELECT 1 FROM "Notification" existing
      WHERE existing."userId" = ${userId}
        AND existing.type = staged.payload->>'type'
        AND existing.title = staged.payload->>'title'
        AND existing.body = staged.payload->>'body'
        AND COALESCE(existing."tmdbId", -1) = COALESCE(NULLIF(staged.payload->>'tmdbId', '')::INTEGER, -1)
        AND existing."createdAt" = COALESCE(NULLIF(staged.payload->>'createdAt', '')::TIMESTAMPTZ, NOW())
    )
  `;

  const preferenceRecord = await tx.libraryImportRecord.findFirst({
    where: { sessionId, collection: "preferences" },
    orderBy: { ordinal: "asc" },
    select: { payload: true },
  });
  let preferencesUpdated = false;
  if (preferenceRecord) {
    const payload = asPayload(preferenceRecord.payload);
    await tx.user.update({
      where: { id: userId },
      data: {
        timezone: String(payload.timezone || "Asia/Baghdad"),
        country: String(payload.country || "IQ"),
        preferredPlatforms: Array.isArray(payload.preferredPlatforms)
          ? payload.preferredPlatforms.map(String).slice(0, 100)
          : [],
      },
    });
    preferencesUpdated = true;
  }

  return {
    mediaRowsAffected: Number(mediaWithIdentity) + Number(mediaWithoutIdentity),
    watchedEpisodeRowsAffected: Number(watchedEpisodeRowsAffected),
    episodeRatingRowsAffected: Number(episodeRatingRowsAffected),
    seriesProgressRowsAffected: Number(seriesProgressRowsAffected),
    watchSessionRowsAffected: Number(watchSessionRowsAffected),
    notificationRowsAffected: Number(notificationRowsAffected),
    preferencesUpdated,
  };
}
