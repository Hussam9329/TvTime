import { NextResponse } from "next/server";
import { isAuthEnabled, getOwnerUsername } from "@/lib/auth";

/**
 * GET /api/auth/status
 * Reports whether the deployment enforces authentication and whether a
 * username is required. The frontend uses this to decide whether to show
 * the username field on the login screen.
 */
export async function GET() {
  return NextResponse.json({
    authEnabled: isAuthEnabled(),
    requiresUsername: getOwnerUsername() !== null,
  });
}
