import { NextResponse, type NextRequest } from "next/server";
import { getSession, isAuthEnabled } from "@/lib/auth";

/**
 * Global middleware.
 *
 * - Protects every non-public route when APP_PASSWORD is set.
 * - In PUBLIC mode (no APP_PASSWORD) the middleware is a no-op so the legacy
 *   personal-app behavior is preserved.
 * - Public assets (`/_next/*`, static files, /api/auth/*, /login) are always allowed.
 */

const PUBLIC_PREFIXES = [
  "/_next",
  "/favicon.ico",
  "/placeholder-poster.svg",
  "/api/auth",
  "/login",
];

const PUBLIC_EXACT = new Set<string>(["/"]);

function isPublicPath(pathname: string): boolean {
  if (PUBLIC_EXACT.has(pathname)) return true;
  return PUBLIC_PREFIXES.some((p) => pathname === p || pathname.startsWith(p + "/") || pathname.startsWith(p));
}

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // Always allow public paths.
  if (isPublicPath(pathname)) return NextResponse.next();

  // When auth is disabled, the middleware must not interfere.
  if (!isAuthEnabled()) return NextResponse.next();

  const session = await getSession(req);
  if (session) return NextResponse.next();

  // Authenticated path with no session.
  if (pathname.startsWith("/api/")) {
    return NextResponse.json(
      {
        error: "Authentication required.",
        code: "UNAUTHORIZED",
        hint: "Sign in at /login to continue.",
      },
      { status: 401 }
    );
  }

  const loginUrl = new URL("/login", req.url);
  loginUrl.searchParams.set("next", pathname + (req.nextUrl.search || ""));
  return NextResponse.redirect(loginUrl);
}

export const config = {
  // Match everything except Next internals and static assets that don't need
  // protection. The middleware function itself short-circuits for PUBLIC mode.
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|placeholder-poster.svg).*)",
  ],
};
