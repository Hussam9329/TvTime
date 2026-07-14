import { z } from "zod";
import { clientMediaTypeSchema } from "@/lib/media-types";

/**
 * Zod schemas for API request bodies.
 *
 * Each schema corresponds to one API endpoint's POST/PATCH body.
 * The schemas are the single source of truth for what the API accepts —
 * if a field is not in the schema, the API rejects it (.strict()).
 *
 * Why .strict(): prevents mass-assignment bugs where a client sends
 * unexpected fields (e.g. { userId: "hacked" }) and the API silently
 * stores them.
 */

// ── POST /api/media/find-or-create ─────────────────────────────────────
export const findOrCreateMediaSchema = z
  .object({
    tmdbId: z.union([z.number().int().positive(), z.null()]).optional(),
    title: z.string().trim().min(1, "title is required").max(500),
    type: clientMediaTypeSchema.optional().default("movie"),
    poster: z.string().url().nullable().optional(),
    year: z
      .string()
      .regex(/^\d{4}$/, "year must be a 4-digit string")
      .nullable()
      .optional(),
    overview: z.string().max(5000).nullable().optional(),
    rating: z.union([z.string(), z.number()]).nullable().optional(),
    runtime: z.number().int().min(1).nullable().optional(),
    genres: z.array(z.string().trim().min(1)).max(20).optional(),
    seasons: z.number().int().min(1).nullable().optional(),
    episodes: z.number().int().min(1).nullable().optional(),
    isAnime: z.boolean().optional(),
    isArabic: z.boolean().optional(),
    originCountry: z.union([z.string(), z.array(z.string())]).optional(),
    originalLanguage: z.string().trim().toLowerCase().optional(),
  })
  .strict();

export type FindOrCreateMediaInput = z.infer<typeof findOrCreateMediaSchema>;

// ── PATCH /api/media/[id] ──────────────────────────────────────────────
// Note: "id" is included because useMediaUpdate sends JSON.stringify(args)
// which includes the id field from the args object. The id is also in the
// URL path, but we accept it in the body and ignore it (the URL wins).
export const updateMediaSchema = z
  .object({
    id: z.string().optional(), // accepted but ignored — URL param is authoritative
    userRating: z.union([z.number().int().min(0).max(100), z.null()]).optional(),
    tmdbId: z.union([z.number().int().positive(), z.null()]).optional(),
    watched: z.boolean().optional(),
    watchedAt: z.union([z.string(), z.null()]).optional(),
    isAnime: z.boolean().optional(),
    isArabic: z.boolean().optional(),
    status: z
      .enum([
        "planned",
        "watching",
        "uptodate",
        "finished",
        "not_started",
      ])
      .optional(),
    ratingStatus: z.string().max(100).nullable().optional(),
    notes: z.string().max(10000).nullable().optional(),
    rewatch: z.boolean().optional(),
    poster: z.string().url().nullable().optional(),
    overview: z.string().max(5000).nullable().optional(),
  })
  .passthrough();

export type UpdateMediaInput = z.infer<typeof updateMediaSchema>;

// ── POST /api/library/watchlist ────────────────────────────────────────
export const watchlistToggleSchema = z
  .object({
    action: z.enum(["add", "remove"]),
    mediaType: clientMediaTypeSchema,
    tmdbId: z.number().int().positive(),
    title: z.string().trim().min(1).max(500),
    posterPath: z.string().nullable().optional(),
    backdropPath: z.string().nullable().optional(),
    overview: z.string().max(5000).nullable().optional(),
    releaseDate: z.string().nullable().optional(),
    voteAverage: z.number().min(0).max(10).nullable().optional(),
    runtime: z.number().int().min(1).nullable().optional(),
    genres: z.array(z.string()).max(20).optional(),
    originCountry: z.union([z.string(), z.array(z.string())]).optional(),
    originalLanguage: z.string().trim().toLowerCase().optional(),
  })
  .strict();

export type WatchlistToggleInput = z.infer<typeof watchlistToggleSchema>;

// ── POST /api/library/watched-movies ───────────────────────────────────
export const watchedMovieToggleSchema = z
  .object({
    action: z.enum(["add", "remove"]),
    tmdbId: z.number().int().positive(),
    title: z.string().trim().min(1).max(500),
    posterPath: z.string().nullable().optional(),
    runtime: z.number().int().min(1).nullable().optional(),
    releaseDate: z.string().nullable().optional(),
    voteAverage: z.number().min(0).max(10).nullable().optional(),
    overview: z.string().max(5000).nullable().optional(),
    genres: z.array(z.string()).max(20).optional(),
    originCountry: z.union([z.string(), z.array(z.string())]).optional(),
    originalLanguage: z.string().trim().toLowerCase().optional(),
  })
  .strict();

export type WatchedMovieToggleInput = z.infer<typeof watchedMovieToggleSchema>;

// ── POST /api/library/ratings ──────────────────────────────────────────
export const ratingMutateSchema = z
  .object({
    action: z.enum(["set", "remove"]),
    mediaType: clientMediaTypeSchema,
    tmdbId: z.number().int().positive(),
    value: z.number().int().min(0).max(100).optional(),
    title: z.string().trim().min(1).max(500).optional(),
    posterPath: z.string().nullable().optional(),
    releaseDate: z.string().nullable().optional(),
    voteAverage: z.number().min(0).max(10).nullable().optional(),
    runtime: z.number().int().min(1).nullable().optional(),
    overview: z.string().max(5000).nullable().optional(),
    genres: z.array(z.string()).max(20).optional(),
    originCountry: z.union([z.string(), z.array(z.string())]).optional(),
    originalLanguage: z.string().trim().toLowerCase().optional(),
  })
  .strict()
  .refine((data) => {
    if (data.action === "set" && (data.value === undefined || data.title === undefined)) {
      return false;
    }
    return true;
  }, "value and title are required when action is 'set'");

export type RatingMutateInput = z.infer<typeof ratingMutateSchema>;

// ── POST /api/auth/login ───────────────────────────────────────────────
export const loginSchema = z
  .object({
    username: z.string().trim().min(1).max(100).optional(),
    password: z.string().min(1).max(1000),
  })
  .strict();

export type LoginInput = z.infer<typeof loginSchema>;

// ── PATCH /api/user ────────────────────────────────────────────────────
export const updateUserSchema = z
  .object({
    name: z.string().trim().min(1).max(30).optional(),
    avatar: z.string().url().nullable().optional(),
  })
  .strict();

export type UpdateUserInput = z.infer<typeof updateUserSchema>;
