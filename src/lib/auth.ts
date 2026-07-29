import { SignJWT, jwtVerify } from "jose";
import { NextRequest, NextResponse } from "next/server";
import { getAuthConfiguration, type AuthConfiguration } from "@/lib/auth-config";
import { resolveRequestIdentity } from "@/lib/request-identity";

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
const SESSION_MAX_AGE_SECONDS = 30 * 24 * 60 * 60;

const ENCODER = new TextEncoder();

interface SessionPayload {
  sub: string;
  name: string;
}

/**
 * Resolve the configured owner username from the environment.
 * Returns null when APP_USERNAME is not set. Auth is still enabled
 * without it — but login requires only the password (legacy behavior).
 */
export function getOwnerUsername(): string | null {
  return getAuthConfiguration().ownerUsername;
}

/**
 * Resolve the configured owner password from the environment.
 * Returns null when auth is not configured (PUBLIC mode).
 */
export function getOwnerPassword(): string | null {
  return getAuthConfiguration().ownerPassword;
}

/**
 * Whether the site requires authentication. When false, the original
 * public-by-default behavior is preserved.
 */
export function isAuthEnabled(): boolean {
  return getAuthConfiguration().mode === "authenticated";
}

function sessionSecret(configuration: AuthConfiguration): Uint8Array {
  if (configuration.mode !== "authenticated" || !configuration.sessionSecret) {
    throw new Error("Authentication configuration is invalid.");
  }
  return ENCODER.encode(configuration.sessionSecret);
}

/**
 * Issue a signed JWT and write it as an httpOnly cookie on the response.
 */
export async function issueSession(res: NextResponse, payload: SessionPayload): Promise<NextResponse> {
  const configuration = getAuthConfiguration();
  const token = await new SignJWT({ name: payload.name })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(payload.sub)
    .setIssuer(SESSION_ISSUER)
    .setAudience(SESSION_AUDIENCE)
    .setIssuedAt()
    .setExpirationTime(`${SESSION_MAX_AGE_SECONDS}s`)
    .sign(sessionSecret(configuration));

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
  const configuration = getAuthConfiguration();
  if (configuration.mode !== "authenticated") return null;

  const token = req.cookies.get(SESSION_COOKIE)?.value;
  if (!token) return null;

  try {
    const { payload } = await jwtVerify(token, sessionSecret(configuration), {
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
  const configuration = getAuthConfiguration();
  const session = await getSession(req);
  const url = new URL(req.url);
  return resolveRequestIdentity({
    mode: configuration.mode,
    sessionUserId: session?.sub,
    queryUserId: url.searchParams.get("userId"),
    headerUserId: req.headers.get("x-user-id"),
  });
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
