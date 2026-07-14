import { NextRequest, NextResponse } from "next/server";
import { timingSafeEqual, createHash } from "node:crypto";
import { issueSession, getOwnerPassword, getOwnerUsername } from "@/lib/auth";

/**
 * POST /api/auth/login
 * Body: { "username": string, "password": string }
 *
 * Sets an httpOnly JWT cookie on success.
 * Returns 401 for wrong credentials, 503 when auth is not configured.
 */
export async function POST(req: NextRequest) {
  const ownerPassword = getOwnerPassword();
  const ownerUsername = getOwnerUsername();

  if (!ownerPassword) {
    return NextResponse.json(
      {
        error: "Authentication is not configured on this deployment. Set APP_PASSWORD to enable login.",
        code: "AUTH_NOT_CONFIGURED",
      },
      { status: 503 }
    );
  }

  let body: { username?: unknown; password?: unknown } = {};
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      { error: "Invalid JSON body.", code: "INVALID_BODY" },
      { status: 400 }
    );
  }

  const { username, password } = body;

  // If APP_USERNAME is configured, the request must include a matching username.
  if (ownerUsername) {
    if (typeof username !== "string" || username.trim().length === 0) {
      return NextResponse.json(
        { error: "Username is required.", code: "USERNAME_REQUIRED" },
        { status: 400 }
      );
    }
    // Constant-time username comparison.
    const uHash = createHash("sha256").update(String(username).trim().normalize("NFC"), "utf8").digest();
    const oHash = createHash("sha256").update(ownerUsername.normalize("NFC"), "utf8").digest();
    if (!timingSafeEqual(uHash, oHash)) {
      await new Promise((r) => setTimeout(r, 400));
      return NextResponse.json(
        { error: "Invalid credentials.", code: "INVALID_CREDENTIALS" },
        { status: 401 }
      );
    }
  }

  if (typeof password !== "string" || password.length === 0) {
    return NextResponse.json(
      { error: "Password is required.", code: "PASSWORD_REQUIRED" },
      { status: 400 }
    );
  }

  // Constant-time password comparison.
  const pHash = createHash("sha256").update(password.normalize("NFC"), "utf8").digest();
  const oPHash = createHash("sha256").update(ownerPassword.normalize("NFC"), "utf8").digest();
  const passwordOk = timingSafeEqual(pHash, oPHash);
  if (!passwordOk) {
    await new Promise((r) => setTimeout(r, 400));
    return NextResponse.json(
      { error: "Invalid credentials.", code: "INVALID_CREDENTIALS" },
      { status: 401 }
    );
  }

  const res = NextResponse.json({
    ok: true,
    user: { id: "cinetrack_default", name: "Hussam" },
  });
  return issueSession(res, { sub: "cinetrack_default", name: "Hussam" });
}
