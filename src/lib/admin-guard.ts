import { NextRequest, NextResponse } from "next/server";

/**
 * TVM-40: Admin guard — always enforces ADMIN_REPAIR_SECRET.
 *
 * If ADMIN_REPAIR_SECRET is not set in the environment, the request is
 * rejected with 503 Service Unavailable (the admin endpoint is disabled
 * until the operator configures the secret).
 *
 * If the secret IS set, the request must provide it via:
 *   - query param ?secret=...  OR
 *   - header x-admin-repair-secret: ...
 *
 * Returns null if authorized, or a NextResponse (401/403/503) if rejected.
 */
export function enforceAdminSecret(req: NextRequest): NextResponse | null {
  const expected = process.env.ADMIN_REPAIR_SECRET;

  if (!expected) {
    // Secret not configured — admin endpoints are disabled for safety.
    return NextResponse.json(
      {
        error: "Admin endpoints are disabled. Set ADMIN_REPAIR_SECRET environment variable to enable.",
        code: "ADMIN_SECRET_NOT_CONFIGURED",
      },
      { status: 503 },
    );
  }

  const provided = req.nextUrl.searchParams.get("secret") || req.headers.get("x-admin-repair-secret");

  if (!provided) {
    return NextResponse.json(
      { error: "Unauthorized. Provide ?secret=... or x-admin-repair-secret header.", code: "ADMIN_SECRET_MISSING" },
      { status: 401 },
    );
  }

  if (provided !== expected) {
    return NextResponse.json(
      { error: "Forbidden. Invalid admin secret.", code: "ADMIN_SECRET_INVALID" },
      { status: 403 },
    );
  }

  return null; // authorized
}
