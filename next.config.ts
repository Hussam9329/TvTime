import type { NextConfig } from "next";
import { withSentryConfig } from "@sentry/nextjs";

// Content-Security-Policy: limits where scripts, styles, frames, and connections
// may come from. Inline scripts/styles are allowed because Next.js injects them
// for hydration; this is the standard Next.js CSP compromise.
// `unsafe-eval` is NOT included — modern Next.js does not need it in production.
//
// When Sentry is enabled (NEXT_PUBLIC_SENTRY_DSN is set), the browser SDK
// sends events to sentry.io. We add it to connect-src so CSP doesn't block
// those requests. The Sentry SDK also injects a script tag for its loader,
// which is why we keep 'unsafe-inline' in script-src (Next.js needs it too).
const sentryDomain = "https://*.sentry.io";
const ContentSecurityPolicy = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline'",
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
  "img-src 'self' data: blob: https: http:",
  "font-src 'self' data: https://fonts.gstatic.com",
  // Allow self + TMDB + Sentry (when enabled):
  `connect-src 'self' https://image.tmdb.org https://api.themoviedb.org ${sentryDomain}`,
  "frame-src 'self' https://www.youtube-nocookie.com https://www.youtube.com",
  "media-src 'self' https:",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
  "object-src 'none'",
  "upgrade-insecure-requests",
].join("; ");

const securityHeaders = [
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" },
  { key: "Content-Security-Policy", value: ContentSecurityPolicy },
];

const nextConfig: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "image.tmdb.org", pathname: "/t/p/**" },
      { protocol: "https", hostname: "img.youtube.com", pathname: "/vi/**" },
    ],
    formats: ["image/avif", "image/webp"],
    deviceSizes: [360, 640, 768, 1024, 1280, 1920],
    imageSizes: [92, 154, 185, 342, 500, 780],
  },
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: securityHeaders,
      },
    ];
  },
};

// Sentry wrapper. When no SENTRY_DSN is configured, withSentryConfig is
// a no-op — it doesn't add any runtime overhead or break the build.
export default withSentryConfig(nextConfig, {
  // Only relevant when SENTRY_AUTH_TOKEN is set — enables source map
  // uploads so stack traces point to the original TypeScript source.
  // Without the token, this is silently skipped.
  silent: true,
  // Tell Sentry which release this is. We use the Vercel commit SHA
  // when available, falling back to a timestamp.
  release: {
    name: process.env.VERCEL_GIT_COMMIT_SHA || `tvtime-${Date.now()}`,
  },
});
