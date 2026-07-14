import type { NextConfig } from "next";

// Content-Security-Policy: limits where scripts, styles, frames, and connections
// may come from. Inline scripts/styles are allowed because Next.js injects them
// for hydration; this is the standard Next.js CSP compromise.
// `unsafe-eval` is NOT included — modern Next.js does not need it in production.
const ContentSecurityPolicy = [
  "default-src 'self'",
  // Next.js inline hydration scripts + styled by Tailwind via style elements:
  "script-src 'self' 'unsafe-inline'",
  // Tailwind + shadcn styles plus any inline style attributes:
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
  // TMDB posters, YouTube thumbnails, data URIs for SVG placeholders:
  "img-src 'self' data: blob: https: http:",
  "font-src 'self' data: https://fonts.gstatic.com",
  // XHR/fetch only to self and TMDB:
  "connect-src 'self' https://image.tmdb.org https://api.themoviedb.org",
  // Allow YouTube embeds in trailer sheets:
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

export default nextConfig;
