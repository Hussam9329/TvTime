import { NextResponse } from "next/server";
import { ZodError, ZodSchema } from "zod";
import { zodErrorResponse } from "@/lib/api-error";

/**
 * Validate a request body against a Zod schema.
 *
 * Returns the parsed (and type-safe) data on success.
 * Returns a NextResponse (400 with structured error) on failure — the
 * caller just needs to `return` it.
 *
 * Usage:
 *   const result = validateBody(findOrCreateMediaSchema, body);
 *   if (result instanceof NextResponse) return result;
 *   const data = result; // typed as z.infer<typeof findOrCreateMediaSchema>
 */
export function validateBody<T>(
  schema: ZodSchema<T>,
  data: unknown
): T | NextResponse {
  try {
    return schema.parse(data);
  } catch (error) {
    if (error instanceof ZodError) {
      return zodErrorResponse(
        error.issues.map((i) => ({
          path: i.path.map((p) => String(p)),
          message: i.message,
        }))
      );
    }
    throw error;
  }
}

/**
 * Validate a query-string parameter as a positive integer.
 * Returns null if the parameter is absent or invalid.
 */
export function parsePositiveInt(
  value: string | null,
  defaultValue: number | null = null
): number | null {
  if (value === null || value === "") return defaultValue;
  const num = Number(value);
  if (!Number.isInteger(num) || num <= 0) return defaultValue;
  return num;
}

/**
 * Clamp a number to a [min, max] range. Useful for limit/pagination params.
 */
export function clampInt(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}
