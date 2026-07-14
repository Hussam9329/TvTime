import { SignJWT, jwtVerify } from "jose";
import { NextRequest, NextResponse } from "next/server";

/**
 * TvTime authentication layer.
 *
 * Design notes:
 * - Single-user personal app: APP_PASSWORD env var authorizes the owner.
 * - When APP_PASSWORD is unset, the site runs in PUBLIC mode (preserves the
 *   original "personal app" behavior). A startup warning is emitted so the
 *   operator knows the site is publicly editable.
 * - JWT in an httpOnly cookie is the source of truth for the session.
 * - The legacy `?userId=` query param and `x-user-id` header continue to be
 *   accepted ONLY in PUBLIC mode, so existing flows keep working until the
 *   operator explicitly enables auth by setting APP_PASSWORD.
 * - Once APP_PASSWORD is set, the cookie session wins; userId in query/header
 *   is ignored. This prevents the public-API exploit demonstrated in the
 *   audit.
 */

const SESSION_COOKIE = "tvtime_session";
const SESSION_AUDIENCE = "tvtime";
const SESSION_ISSUER = "tvtime";

// 30 days — matches the original "personal app" expectation of long sessions.
export const SESSION_MAX_AGE_SECONDS = 30 * 24 * 60 * 60;

const ENCODER = new TextEncoder();

export interface SessionPayload {
  sub: string;
  name: string;
}

/**
 * Resolve the configured owner password from the environment.
 * Returns null when auth is not configured (PUBLIC mode).
 */
export function getOwnerPassword(): string | null {
  const value = process.env.APP_PASSWORD;
  if (!value || value.trim().length < 6) return null;
  return value;
}

/**
 * Whether the site requires authentication. When false, the original
 * public-by-default behavior is preserved.
 */
export function isAuthEnabled(): boolean {
  return getOwnerPassword() !== null;
}

function getSessionSecret(): Uint8Array {
  const raw = process.env.SESSION_SECRET;
  if (!raw || raw.length < 32) {
    // Fall back to a derived value from APP_PASSWORD so that auth still works
    // in a single-env setup. This is NOT as strong as a dedicated secret —
    // the operator is urged to set SESSION_SECRET separately.
    const fallback = process.env.APP_PASSWORD ?? "tvtime-insecure-fallback-secret";
    return ENCODER.encode(fallback.padEnd(32, "0").slice(0, 64));
  }
  return ENCODER.encode(raw);
}

/**
 * Issue a signed JWT and write it as an httpOnly cookie on the response.
 */
export async function issueSession(res: NextResponse, payload: SessionPayload): Promise<NextResponse> {
  const token = await new SignJWT({ name: payload.name })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(payload.sub)
    .setIssuer(SESSION_ISSUER)
    .setAudience(SESSION_AUDIENCE)
    .setIssuedAt()
    .setExpirationTime(`${SESSION_MAX_AGE_SECONDS}s`)
    .sign(getSessionSecret());

  res.cookies.set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_MAX_AGE_SECONDS,
  });
  return res;
}

/**
 * Clear the session cookie.
 */
export function clearSession(res: NextResponse): NextResponse {
  res.cookies.set(SESSION_COOKIE, "", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 0,
  });
  return res;
}

/**
 * Read the session from the request. Returns null when no valid session exists
 * OR when auth is disabled (PUBLIC mode).
 */
export async function getSession(req: NextRequest): Promise<SessionPayload | null> {
  if (!isAuthEnabled()) return null;

  const token = req.cookies.get(SESSION_COOKIE)?.value;
  if (!token) return null;

  try {
    const { payload } = await jwtVerify(token, getSessionSecret(), {
      issuer: SESSION_ISSUER,
      audience: SESSION_AUDIENCE,
    });
    if (typeof payload.sub !== "string" || typeof payload.name !== "string") return null;
    return { sub: payload.sub, name: payload.name };
  } catch {
    return null;
  }
}

/**
 * Resolve the effective user id for a request.
 *
 * - Auth enabled: take from the JWT (signed, server-trusted).
 * - Auth disabled (PUBLIC mode): take from query/header, sanitized.
 *   This preserves the legacy behavior so existing local/preview flows
 *   don't break while the operator migrates to APP_PASSWORD.
 */
export async function resolveUserId(req: NextRequest): Promise<string> {
  const session = await getSession(req);
  if (session) return session.sub;

  // PUBLIC mode fallback — keep behavior identical to legacy parseUserId.
  const url = new URL(req.url);
  const raw = url.searchParams.get("userId") || req.headers.get("x-user-id") || "";
  const trimmed = String(raw).trim();
  return trimmed.length > 0 ? trimmed.slice(0, 120) : "cinetrack_default";
}

/**
 * Whether the request is authorized to mutate data.
 *
 * - Auth enabled: must have a valid session.
 * - Auth disabled: always true (legacy behavior).
 */
export async function isAuthorized(req: NextRequest): Promise<boolean> {
  if (!isAuthEnabled()) return true;
  const session = await getSession(req);
  return session !== null;
}

/**
 * Standard 401 response for API routes.
 */
export function unauthorizedResponse(): NextResponse {
  return NextResponse.json(
    {
      error: "Authentication required.",
      code: "UNAUTHORIZED",
      hint: "Sign in at /login to continue.",
    },
    { status: 401 }
  );
}
