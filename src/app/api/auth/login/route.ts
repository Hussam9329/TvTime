import { NextRequest, NextResponse } from "next/server";
import { timingSafeEqual } from "node:crypto";
import { issueSession, getOwnerPassword } from "@/lib/auth";

/**
 * POST /api/auth/login
 * Body: { "password": string }
 *
 * Sets an httpOnly JWT cookie on success.
 * Returns 401 for wrong password, 503 when auth is not configured.
 */
export async function POST(req: NextRequest) {
  const ownerPassword = getOwnerPassword();
  if (!ownerPassword) {
    return NextResponse.json(
      {
        error: "Authentication is not configured on this deployment. Set APP_PASSWORD to enable login.",
        code: "AUTH_NOT_CONFIGURED",
      },
      { status: 503 }
    );
  }

  let body: { password?: unknown } = {};
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      { error: "Invalid JSON body.", code: "INVALID_BODY" },
      { status: 400 }
    );
  }

  const { password } = body;
  if (typeof password !== "string" || password.length === 0) {
    return NextResponse.json(
      { error: "Password is required.", code: "PASSWORD_REQUIRED" },
      { status: 400 }
    );
  }

  // Constant-time comparison to mitigate timing attacks. We hash both sides
  // with SHA-256 first so the lengths always match — leaking the password
  // length via early return is otherwise unavoidable with raw timingSafeEqual.
  const { createHash } = await import("node:crypto");
  const hash = (s: string) => createHash("sha256").update(s.normalize("NFC"), "utf8").digest();
  const a = hash(password);
  const b = hash(ownerPassword);
  const equals = timingSafeEqual(a, b);
  if (!equals) {
    // Tiny delay to slow brute force without locking out the single legit user.
    await new Promise((r) => setTimeout(r, 400));
    return NextResponse.json(
      { error: "Invalid password.", code: "INVALID_CREDENTIALS" },
      { status: 401 }
    );
  }

  const res = NextResponse.json({
    ok: true,
    user: { id: "cinetrack_default", name: "Hussam" },
  });
  return issueSession(res, { sub: "cinetrack_default", name: "Hussam" });
}
