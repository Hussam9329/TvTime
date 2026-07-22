import { NextResponse, type NextRequest } from "next/server";
import {
  getSession,
  unauthorizedResponse,
} from "@/lib/auth";
import { authConfigurationMessage, getAuthConfiguration } from "@/lib/auth-config";

/**
 * Global authentication boundary.
 *
 * - Production never becomes public because a secret is missing or weak.
 * - Explicit public mode is accepted only by auth-config on non-production.
 * - Login/auth endpoints and static assets remain available so an operator can
 *   see a safe configuration error instead of an empty application.
 */

const PUBLIC_PREFIXES = [
  "/_next",
  "/favicon.ico",
  "/placeholder-poster.svg",
  "/api/auth",
  "/login",
  "/robots.txt",
  "/sitemap.xml",
];

function isPublicPath(pathname: string): boolean {
  return PUBLIC_PREFIXES.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`));
}

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // Auth endpoints/login/static assets remain reachable in every mode.
  if (isPublicPath(pathname)) return NextResponse.next();

  const configuration = getAuthConfiguration();

  if (configuration.mode === "invalid") {
    if (pathname.startsWith("/api/")) {
      return NextResponse.json(
        { error: authConfigurationMessage(configuration.code), code: configuration.code },
        { status: 503 },
      );
    }

    const loginUrl = new URL("/login", req.url);
    loginUrl.searchParams.set("configuration", "error");
    return NextResponse.redirect(loginUrl);
  }

  if (configuration.mode === "public") {
    return NextResponse.next();
  }

  const session = await getSession(req);
  if (session) return NextResponse.next();

  if (pathname.startsWith("/api/")) {
    return unauthorizedResponse();
  }

  const loginUrl = new URL("/login", req.url);
  loginUrl.searchParams.set("next", pathname + (req.nextUrl.search || ""));
  return NextResponse.redirect(loginUrl);
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|placeholder-poster.svg).*)"],
};
