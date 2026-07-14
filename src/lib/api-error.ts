import { NextResponse } from "next/server";

/**
 * Unified error contract for all API routes.
 *
 * Every error response from /api/* follows this shape:
 *   { error: string, code: ErrorCode, details?: Record<string, unknown> }
 *
 * The HTTP status is derived from the code — callers don't need to
 * remember which status goes with which error.
 *
 * Usage:
 *   throw new ApiError("VALIDATION_ERROR", "title is required");
 *   // or with details:
 *   throw new ApiError("CONFLICT", "Show already finished", { tmdbId: 123 });
 *
 * In the route handler:
 *   try { ... } catch (error) { return handleError(error); }
 */

export type ErrorCode =
  | "UNAUTHORIZED"
  | "FORBIDDEN"
  | "NOT_FOUND"
  | "VALIDATION_ERROR"
  | "CONFLICT"
  | "RATE_LIMITED"
  | "INTERNAL_ERROR"
  | "ADMIN_SECRET_MISSING"
  | "ADMIN_SECRET_INVALID"
  | "WATCHLIST_REQUIRES_UNWATCHED"
  | "TV_STATE_REQUIRES_EPISODE_ENGINE"
  | "TV_PROGRESS_MUST_BE_CHANGED_BY_EPISODES"
  | "INVALID_TV_TRACKING_STATE"
  | "INVALID_TV_TRACKING_CATEGORY"
  | "INVALID_TV_TRACKING_WORLD"
  | "INVALID_CALENDAR_WORLD"
  | "RATING_WATCH_STATE_MUST_BE_SEPARATE"
  | "CONFIRMATION_REQUIRED"
  | "TMDB_TIMEOUT"
  | "TMDB_ERROR";

const STATUS_BY_CODE: Record<ErrorCode, number> = {
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  VALIDATION_ERROR: 400,
  CONFLICT: 409,
  RATE_LIMITED: 429,
  INTERNAL_ERROR: 500,
  ADMIN_SECRET_MISSING: 401,
  ADMIN_SECRET_INVALID: 403,
  WATCHLIST_REQUIRES_UNWATCHED: 409,
  TV_STATE_REQUIRES_EPISODE_ENGINE: 409,
  TV_PROGRESS_MUST_BE_CHANGED_BY_EPISODES: 409,
  INVALID_TV_TRACKING_STATE: 400,
  INVALID_TV_TRACKING_CATEGORY: 400,
  INVALID_TV_TRACKING_WORLD: 400,
  INVALID_CALENDAR_WORLD: 400,
  RATING_WATCH_STATE_MUST_BE_SEPARATE: 400,
  CONFIRMATION_REQUIRED: 409,
  TMDB_TIMEOUT: 504,
  TMDB_ERROR: 502,
};

export class ApiError extends Error {
  constructor(
    public code: ErrorCode,
    message: string,
    public details?: Record<string, unknown>
  ) {
    super(message);
    this.name = "ApiError";
  }

  toResponse(): NextResponse {
    return NextResponse.json(
      {
        error: this.message,
        code: this.code,
        ...(this.details ? { details: this.details } : {}),
      },
      { status: STATUS_BY_CODE[this.code] }
    );
  }
}

/**
 * Centralized error handler for API routes. Catches ApiError and returns
 * its structured response. For unknown errors, logs and returns 500.
 *
 * Usage in a route:
 *   export async function GET(req: NextRequest) {
 *     try {
 *       // ... route logic
 *     } catch (error) {
 *       return handleError(error);
 *     }
 *   }
 */
export function handleError(error: unknown): NextResponse {
  if (error instanceof ApiError) {
    return error.toResponse();
  }

  // Distinguish TMDB timeout errors (thrown by src/lib/tmdb.ts) so the
  // client can show "TMDB is slow right now" instead of a generic 500.
  if (error instanceof Error) {
    if (error.name === "AbortError" || error.message.includes("TMDB timed out")) {
      return new ApiError("TMDB_TIMEOUT", error.message).toResponse();
    }
    if (error.message.includes("TMDB error") || error.message.includes("TMDB_API_KEY")) {
      return new ApiError("TMDB_ERROR", error.message).toResponse();
    }
  }

  // Unknown error — log full details server-side, return generic message.
  console.error("[api:error]", error);
  return new ApiError(
    "INTERNAL_ERROR",
    "An unexpected error occurred. Please try again."
  ).toResponse();
}

/**
 * Convert a ZodError into a structured API response.
 * Used by validateBody() below.
 */
export function zodErrorResponse(
  issues: Array<{ path: (string | number)[]; message: string }>
): NextResponse {
  return NextResponse.json(
    {
      error: "Validation failed.",
      code: "VALIDATION_ERROR" as ErrorCode,
      details: issues.map((i) => ({
        field: i.path.join(".") || "(root)",
        message: i.message,
      })),
    },
    { status: 400 }
  );
}
