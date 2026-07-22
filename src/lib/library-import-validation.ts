import { randomUUID } from "node:crypto";
import { z } from "zod";
import { detectIsArabic, normalizeCountryCodes } from "@/lib/arabic-media";
import {
  LIBRARY_BACKUP_KIND,
  LIBRARY_COLLECTIONS,
  LIBRARY_IMPORT_MAX_RECORDS,
  LIBRARY_SUPPORTED_BACKUP_VERSIONS,
  isSupportedBackupApp,
  normalizeCollectionCounts,
  type LibraryCollection,
  type LibraryTransferRecord,
} from "@/lib/library-transfer-types";

const finiteNumber = z.preprocess((value) => {
  if (value === null || value === undefined || value === "") return undefined;
  const number = Number(value);
  return Number.isFinite(number) ? number : value;
}, z.number().finite());

const optionalPositiveInt = z.preprocess((value) => {
  if (value === null || value === undefined || value === "") return null;
  const number = Number(value);
  return Number.isInteger(number) && number > 0 ? number : value;
}, z.number().int().positive().nullable());

const optionalNonNegativeInt = z.preprocess((value) => {
  if (value === null || value === undefined || value === "") return null;
  const number = Number(value);
  return Number.isInteger(number) && number >= 0 ? number : value;
}, z.number().int().nonnegative().nullable());

function parseBoolean(value: unknown): unknown {
  if (typeof value === "boolean") return value;
  if (value === 1 || value === "1") return true;
  if (value === 0 || value === "0") return false;
  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase();
    if (["true", "yes", "on"].includes(normalized)) return true;
    if (["false", "no", "off"].includes(normalized)) return false;
  }
  return value;
}

const strictBoolean = z.preprocess(parseBoolean, z.boolean());
const nullableBoolean = z.preprocess((value) => {
  if (value === null || value === undefined || value === "") return null;
  return parseBoolean(value);
}, z.boolean().nullable());

const nullableString = (max: number) => z.preprocess((value) => {
  if (value === null || value === undefined) return null;
  const text = String(value).trim();
  return text ? text : null;
}, z.string().max(max).nullable());

const stringArray = z.preprocess((value) => {
  if (Array.isArray(value)) return value;
  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value);
      if (Array.isArray(parsed)) return parsed;
    } catch {
      return value.split(",");
    }
  }
  return [];
}, z.array(z.string().max(200)).max(100)).transform((values) => (
  [...new Set(values.map((value) => value.trim()).filter(Boolean))]
));

const nullableIsoDate = z.preprocess((value) => {
  if (value === null || value === undefined || value === "") return null;
  const date = new Date(String(value));
  return Number.isNaN(date.getTime()) ? value : date.toISOString();
}, z.string().datetime({ offset: true }).nullable());

const nullableMediaStatus = z.preprocess((value) => {
  if (value === null || value === undefined || value === "") return null;
  const normalized = String(value).trim().toLowerCase().replace(/[\s-]+/g, "_");
  const aliases: Record<string, string> = {
    watchlist: "planned",
    havent_started: "not_started",
    "haven't_started": "not_started",
    in_progress: "watching",
    up_to_date: "uptodate",
    completed: "finished",
  };
  return aliases[normalized] ?? normalized;
}, z.enum(["planned", "not_started", "watching", "uptodate", "finished", "watched"]).nullable());

const mediaSchema = z.object({
  tmdbId: optionalPositiveInt.default(null),
  title: z.preprocess((value) => String(value ?? "").trim(), z.string().min(1).max(500)),
  originalTitle: nullableString(500).default(null),
  year: nullableString(32).default(null),
  type: z.preprocess((value) => String(value ?? "").trim().toLowerCase() === "tv" ? "series" : String(value ?? "").trim().toLowerCase(),
    z.enum(["movie", "series"])),
  poster: nullableString(2_000).default(null),
  rating: nullableString(64).default(null),
  overview: nullableString(20_000).default(null),
  genres: stringArray.default([]),
  episodes: optionalNonNegativeInt.default(null),
  seasons: optionalNonNegativeInt.default(null),
  duration: nullableString(128).default(null),
  status: nullableMediaStatus.default(null),
  tags: stringArray.default([]),
  notes: nullableString(100_000).default(null),
  watched: strictBoolean.default(false),
  watchedAt: nullableIsoDate.default(null),
  userRating: z.preprocess((value) => value === null || value === undefined || value === "" ? null : Number(value),
    z.number().int().min(0).max(100).nullable()).default(null),
  rewatch: strictBoolean.default(false),
  runtime: optionalNonNegativeInt.default(null),
  ratingStatus: nullableString(128).default(null),
  isAnime: strictBoolean.default(false),
  isArabic: strictBoolean.default(false),
  originalLanguage: nullableString(32).default(null),
  originCountries: stringArray.default([]),
  isFollowing: strictBoolean.default(false),
  notifyOnNewEpisode: nullableBoolean.default(null),
  rewatchCount: z.preprocess((value) => value === null || value === undefined || value === "" ? 0 : Number(value), z.number().int().nonnegative().max(10_000)).default(0),
  addedAt: nullableIsoDate.default(null),
});

const watchedEpisodeSchema = z.object({
  showId: z.preprocess((value) => Number(value), z.number().int().positive()),
  seasonNumber: z.preprocess((value) => Number(value), z.number().int().nonnegative()),
  episodeNumber: z.preprocess((value) => Number(value), z.number().int().positive()),
  episodeName: nullableString(500).default(null),
  runtime: optionalNonNegativeInt.default(null),
  watchedAt: nullableIsoDate.default(null),
});

const episodeRatingSchema = z.object({
  mediaType: z.preprocess((value) => String(value ?? "").trim(), z.string().regex(/^episode:\d+:\d+$/).max(64)),
  tmdbId: z.preprocess((value) => Number(value), z.number().int().positive()),
  title: z.preprocess((value) => String(value ?? "").trim(), z.string().min(1).max(700)),
  posterPath: nullableString(2_000).default(null),
  value: finiteNumber.transform((value) => Math.round(value)).pipe(z.number().int().min(0).max(100)),
  createdAt: nullableIsoDate.default(null),
  updatedAt: nullableIsoDate.default(null),
});

const watchSessionSchema = z.object({
  mediaType: z.preprocess((value) => String(value ?? "").trim().toLowerCase(), z.string().min(1).max(40).regex(/^[a-z0-9_-]+$/)),
  tmdbId: z.preprocess((value) => Number(value), z.number().int().positive()),
  title: z.preprocess((value) => String(value ?? "").trim(), z.string().min(1).max(500)),
  season: optionalNonNegativeInt.default(null),
  episode: optionalPositiveInt.default(null),
  watchedAt: nullableIsoDate.default(null),
  duration: optionalNonNegativeInt.default(null),
  rewatch: strictBoolean.default(false),
  rating: z.preprocess((value) => value === null || value === undefined || value === "" ? null : Number(value), z.number().int().min(0).max(100).nullable()).default(null),
  source: nullableString(200).default(null),
  notes: nullableString(100_000).default(null),
  createdAt: nullableIsoDate.default(null),
});

const notificationSchema = z.object({
  type: z.preprocess((value) => String(value ?? "").trim(), z.string().min(1).max(64).regex(/^[a-z0-9_-]+$/i)),
  title: z.preprocess((value) => String(value ?? "").trim(), z.string().min(1).max(500)),
  body: z.preprocess((value) => String(value ?? "").trim(), z.string().min(1).max(10_000)),
  tmdbId: optionalPositiveInt.default(null),
  mediaType: nullableString(64).default(null),
  read: strictBoolean.default(false),
  scheduledFor: nullableIsoDate.default(null),
  createdAt: nullableIsoDate.default(null),
});

const preferencesSchema = z.object({
  timezone: z.preprocess((value) => String(value ?? "Asia/Baghdad").trim(), z.string().min(1).max(100)),
  country: z.preprocess((value) => String(value ?? "IQ").trim().toUpperCase(), z.string().regex(/^[A-Z]{2}$/)),
  preferredPlatforms: stringArray.default([]),
});

const collectionsSchema = z.preprocess(normalizeCollectionCounts, z.object({
  media: z.number().int().nonnegative(),
  watchedEpisodes: z.number().int().nonnegative(),
  episodeRatings: z.number().int().nonnegative(),
  watchSessions: z.number().int().nonnegative(),
  notifications: z.number().int().nonnegative(),
  preferences: z.number().int().nonnegative().max(1),
}));

export const importStartSchema = z.object({
  manifest: z.object({
    kind: z.literal(LIBRARY_BACKUP_KIND),
    version: z.union(LIBRARY_SUPPORTED_BACKUP_VERSIONS.map((version) => z.literal(version)) as [z.ZodLiteral<5>, z.ZodLiteral<6>]),
    format: z.literal("ndjson"),
    app: z.string().optional().refine((value) => value === undefined || isSupportedBackupApp(value), {
      message: "Unsupported backup application identity",
    }),
    collections: collectionsSchema,
    totalRecords: z.number().int().nonnegative().max(LIBRARY_IMPORT_MAX_RECORDS),
  }).superRefine((manifest, ctx) => {
    const sum = Object.values(manifest.collections).reduce((total, value) => total + value, 0);
    if (sum !== manifest.totalRecords) {
      ctx.addIssue({ code: "custom", message: "Manifest collection counts do not match totalRecords" });
    }
  }),
});

export const importChunkSchema = z.object({
  sequence: z.number().int().nonnegative().max(10_000),
  checksum: z.string().regex(/^[a-f0-9]{64}$/),
  records: z.array(z.object({
    collection: z.enum(LIBRARY_COLLECTIONS),
    ordinal: z.number().int().nonnegative().max(LIBRARY_IMPORT_MAX_RECORDS),
    data: z.unknown(),
  })).min(1).max(500),
});

export const importFinalizeSchema = z.object({
  expectedChunks: z.number().int().nonnegative().max(10_001),
  expectedRecords: z.number().int().nonnegative().max(LIBRARY_IMPORT_MAX_RECORDS),
});

export const importCommitSchema = z.object({ confirm: z.string().min(1).max(500) });

export type NormalizedImportRecord = {
  collection: LibraryCollection;
  ordinal: number;
  payload: Record<string, unknown>;
};

export function normalizeImportRecord(record: LibraryTransferRecord): NormalizedImportRecord {
  if (record.collection === "media") {
    const parsed = mediaSchema.parse(record.data);
    const originalLanguage = parsed.originalLanguage?.toLowerCase() ?? null;
    const originCountries = normalizeCountryCodes(parsed.originCountries);
    const shouldPromoteArabic = detectIsArabic({ originalLanguage, originCountry: originCountries });
    const isArabic = parsed.isArabic || shouldPromoteArabic;
    const isAnime = !isArabic && parsed.isAnime;
    const requestedSeriesRating = parsed.type === "series" && parsed.userRating !== null;
    return {
      collection: record.collection,
      ordinal: record.ordinal,
      payload: {
        ...parsed,
        importId: randomUUID(),
        status: parsed.type === "series" ? (parsed.status === "planned" ? "planned" : "not_started") : parsed.status,
        watched: parsed.type === "series" ? false : parsed.watched,
        watchedAt: parsed.type === "series" ? null : parsed.watchedAt,
        userRating: parsed.type === "series" ? null : parsed.userRating,
        requestedSeriesRating,
        isArabic,
        isAnime,
        originalLanguage,
        originCountries,
        isFollowing: parsed.type === "series" && parsed.isFollowing,
      },
    };
  }

  if (record.collection === "watchedEpisodes") {
    return { collection: record.collection, ordinal: record.ordinal, payload: { ...watchedEpisodeSchema.parse(record.data), importId: randomUUID() } };
  }

  if (record.collection === "episodeRatings") {
    const parsed = episodeRatingSchema.parse(record.data);
    const match = /^episode:(\d+):(\d+)$/.exec(parsed.mediaType);
    if (!match) throw new Error("Invalid episode rating identity");
    return {
      collection: record.collection,
      ordinal: record.ordinal,
      payload: { ...parsed, importId: randomUUID(), seasonNumber: Number(match[1]), episodeNumber: Number(match[2]) },
    };
  }

  if (record.collection === "watchSessions") {
    return { collection: record.collection, ordinal: record.ordinal, payload: { ...watchSessionSchema.parse(record.data), importId: randomUUID(), mediaId: null } };
  }

  if (record.collection === "notifications") {
    return { collection: record.collection, ordinal: record.ordinal, payload: { ...notificationSchema.parse(record.data), importId: randomUUID() } };
  }

  return { collection: record.collection, ordinal: record.ordinal, payload: preferencesSchema.parse(record.data) };
}
