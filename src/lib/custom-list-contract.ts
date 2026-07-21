import { z } from "zod";
import type { MediaItem } from "@/lib/tmdb";

export const LIST_NAME_MAX = 120;
export const LIST_DESCRIPTION_MAX = 1_000;
export const LIST_TITLE_MAX = 500;

export const listMediaTypeSchema = z.enum(["movie", "tv"]);
export type ListMediaType = z.infer<typeof listMediaTypeSchema>;

const trimmedText = (max: number) => z.string().trim().max(max);
const nullableTrimmedText = (max: number) => z.preprocess(
  (value) => value == null ? null : String(value).trim() || null,
  z.string().max(max).nullable(),
);

export const createCustomListSchema = z.object({
  name: trimmedText(LIST_NAME_MAX).min(1),
  description: nullableTrimmedText(LIST_DESCRIPTION_MAX).optional().default(null),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional().default("#f59e0b"),
  isPublic: z.boolean().optional().default(false),
});

export const updateCustomListSchema = z.object({
  name: trimmedText(LIST_NAME_MAX).min(1).optional(),
  description: nullableTrimmedText(LIST_DESCRIPTION_MAX).optional(),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(),
  isPublic: z.boolean().optional(),
}).refine((value) => Object.keys(value).length > 0, "At least one field is required");

export const customListItemSchema = z.object({
  tmdbId: z.coerce.number().int().positive(),
  mediaType: listMediaTypeSchema,
  title: trimmedText(LIST_TITLE_MAX).min(1),
  posterPath: nullableTrimmedText(2_000).optional().default(null),
});

export type ListSearchResult = {
  tmdbId: number;
  mediaType: ListMediaType;
  title: string;
  posterPath: string | null;
  year: string | null;
};

/** Convert raw TMDB multi-search rows into the only DTO Custom Lists accepts. */
export function normalizeListSearchResults(rows: readonly MediaItem[]): ListSearchResult[] {
  const seen = new Set<string>();
  const output: ListSearchResult[] = [];

  for (const row of rows) {
    const mediaType = row.media_type;
    if (mediaType !== "movie" && mediaType !== "tv") continue;
    const tmdbId = Number(row.id);
    const title = (row.title || row.name || row.original_title || row.original_name || "").trim();
    if (!Number.isInteger(tmdbId) || tmdbId <= 0 || !title) continue;

    const key = `${mediaType}:${tmdbId}`;
    if (seen.has(key)) continue;
    seen.add(key);
    const date = row.release_date || row.first_air_date || "";
    output.push({
      tmdbId,
      mediaType,
      title,
      posterPath: row.poster_path || null,
      year: /^\d{4}/.test(date) ? date.slice(0, 4) : null,
    });
  }

  return output;
}
