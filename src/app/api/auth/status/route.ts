import { NextResponse } from "next/server";
import { isAuthEnabled } from "@/lib/auth";

/**
 * GET /api/auth/status
 * Reports whether the deployment enforces authentication. The frontend uses
 * this to decide whether to show a login screen or proceed as guest.
 */
export async function GET() {
  return NextResponse.json({
    authEnabled: isAuthEnabled(),
  });
}
