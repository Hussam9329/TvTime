import { z } from "zod";

/**
 * Central media type definitions.
 *
 * The app has TWO type vocabularies that must be kept in sync:
 * - CLIENT types: "movie" | "tv" (matches TMDB API)
 * - SERVER types: "movie" | "series" | "book" | "game" (stored in DB)
 *
 * Previously, the mapping `"tv" → "series"` was scattered across 20+ files.
 * This module is the single source of truth. Any new code that needs to
 * convert between client and server types MUST use these helpers.
 */

// ── Server-side types (stored in Media.type column) ────────────────────
export const SERVER_MEDIA_TYPES = ["movie", "series", "book", "game"] as const;
export type ServerMediaType = (typeof SERVER_MEDIA_TYPES)[number];

export const serverMediaTypeSchema = z.enum(SERVER_MEDIA_TYPES);

// ── Client-side types (used by TMDB API and the React app) ─────────────
export const CLIENT_MEDIA_TYPES = ["movie", "tv"] as const;
export type ClientMediaType = (typeof CLIENT_MEDIA_TYPES)[number];

export const clientMediaTypeSchema = z.enum(CLIENT_MEDIA_TYPES);

// ── Conversion helpers ─────────────────────────────────────────────────

/**
 * Convert a client type ("movie" | "tv") to the server type stored in DB.
 * "tv" → "series", "movie" → "movie".
 * Falls back to "movie" for unknown values (defensive).
 */
export function clientToServer(clientType: ClientMediaType | string): ServerMediaType {
  if (clientType === "tv") return "series";
  if (clientType === "series") return "series";
  if (clientType === "book") return "book";
  if (clientType === "game") return "game";
  return "movie";
}

/**
 * Convert a server type to the client type expected by the React app.
 * "series" → "tv", "movie" → "movie".
 * Books and games have no client representation — returns null.
 */
export function serverToClient(serverType: ServerMediaType | string): ClientMediaType | null {
  if (serverType === "movie") return "movie";
  if (serverType === "series") return "tv";
  return null;
}

/**
 * Normalize any media type input to the server form. Accepts both client
 * and server vocabulary. Used by API routes that receive type from the
 * client but need to store/query the DB.
 */
export function normalizeMediaType(input: unknown): ServerMediaType {
  if (typeof input !== "string") return "movie";
  return clientToServer(input);
}
