import { NextResponse } from "next/server";
import { clearSession, isAuthEnabled } from "@/lib/auth";

/**
 * POST /api/auth/logout
 * Clears the session cookie.
 */
export async function POST() {
  if (!isAuthEnabled()) {
    return NextResponse.json({ ok: true, note: "auth not configured" });
  }
  const res = NextResponse.json({ ok: true });
  return clearSession(res);
}
