import { NextRequest, NextResponse } from "next/server";
import { timingSafeEqual, createHash } from "node:crypto";
import { issueSession, getOwnerPassword, getOwnerUsername } from "@/lib/auth";
import { getRemainingBlockTime, recordFailedAttempt, clearAttempts, getClientIp } from "@/lib/rate-limit";

/**
 * POST /api/auth/login
 * Body: { "username": string, "password": string }
 *
 * Sets an httpOnly JWT cookie on success.
 * Returns 401 for wrong credentials, 503 when auth is not configured,
 * 429 when the IP is rate-limited.
 *
 * Rate limiting: 5 failed attempts per IP within 15 minutes → 15-minute block.
 * Successful logins clear the failure counter so occasional typos don't
 * accumulate into a lockout.
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

  // ── Rate limit check ──────────────────────────────────────────────
  const clientIp = getClientIp(req);
  const remainingBlockMs = getRemainingBlockTime(clientIp);
  if (remainingBlockMs !== null) {
    const minutes = Math.ceil(remainingBlockMs / 60_000);
    return NextResponse.json(
      {
        error: `تم حجب هذا الجهاز مؤقتاً بسبب محاولات دخول كثيرة. حاول مرة أخرى بعد ${minutes} دقيقة.`,
        code: "RATE_LIMITED",
        retryAfter: Math.ceil(remainingBlockMs / 1000),
      },
      {
        status: 429,
        headers: {
          "Retry-After": String(Math.ceil(remainingBlockMs / 1000)),
        },
      }
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
  const credentialsValid = validateCredentials(ownerPassword, ownerUsername, username, password);
  if (credentialsValid !== "OK") {
    // Record the failed attempt for rate-limiting purposes.
    const result = recordFailedAttempt(clientIp);
    await new Promise((r) => setTimeout(r, 400)); // constant-ish delay

    if (result.blocked) {
      return NextResponse.json(
        {
          error: "تم حجب هذا الجهاز مؤقتاً بسبب محاولات دخول كثيرة. حاول مرة أخرى بعد 15 دقيقة.",
          code: "RATE_LIMITED",
          retryAfter: 900,
        },
        {
          status: 429,
          headers: { "Retry-After": "900" },
        }
      );
    }

    // For validation errors (missing fields), return a 400. For invalid
    // credentials, return a 401 — but don't reveal which one to avoid
    // user-enumeration.
    if (credentialsValid === "MISSING_FIELD") {
      return NextResponse.json(
        { error: "Username and password are required.", code: "CREDENTIALS_REQUIRED" },
        { status: 400 }
      );
    }
    return NextResponse.json(
      {
        error: "بيانات الدخول غير صحيحة.",
        code: "INVALID_CREDENTIALS",
        remainingAttempts: result.remainingAttempts,
      },
      { status: 401 }
    );
  }

  // ── Success ───────────────────────────────────────────────────────
  clearAttempts(clientIp);
  const res = NextResponse.json({
    ok: true,
    user: { id: "cinetrack_default", name: "Hussam" },
  });
  return issueSession(res, { sub: "cinetrack_default", name: "Hussam" });
}

type CredentialResult = "OK" | "INVALID" | "MISSING_FIELD";

function validateCredentials(
  ownerPassword: string,
  ownerUsername: string | null,
  username: unknown,
  password: unknown
): CredentialResult {
  if (typeof password !== "string" || password.length === 0) {
    return "MISSING_FIELD";
  }
  if (ownerUsername) {
    if (typeof username !== "string" || username.trim().length === 0) {
      return "MISSING_FIELD";
    }
    const uHash = createHash("sha256").update(String(username).trim().normalize("NFC"), "utf8").digest();
    const oHash = createHash("sha256").update(ownerUsername.normalize("NFC"), "utf8").digest();
    if (!timingSafeEqual(uHash, oHash)) return "INVALID";
  }
  const pHash = createHash("sha256").update(password.normalize("NFC"), "utf8").digest();
  const oPHash = createHash("sha256").update(ownerPassword.normalize("NFC"), "utf8").digest();
  if (!timingSafeEqual(pHash, oPHash)) return "INVALID";
  return "OK";
}
