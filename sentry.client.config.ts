import * as Sentry from "@sentry/nextjs";

/**
 * Sentry client-side initialization.
 *
 * Activates ONLY when NEXT_PUBLIC_SENTRY_DSN is set. Otherwise this file
 * is a no-op — no errors sent, no performance monitoring, no session
 * replays. This lets the app build and run without a Sentry account;
 * the operator opts in by setting the env var.
 *
 * To enable:
 *   1. Create a free Sentry project at https://sentry.io
 *   2. Copy the DSN from Project Settings → Client Keys
 *   3. Set NEXT_PUBLIC_SENTRY_DSN in Vercel env vars (all environments)
 *   4. Optional: set SENTRY_AUTH_TOKEN + SENTRY_ORG + SENTRY_PROJECT for
 *      source map uploads (improves stack traces)
 *   5. Redeploy
 *
 * What gets captured:
 *   - Unhandled exceptions in client components
 *   - Unhandled promise rejections
 *   - 10% of performance transactions (traces)
 *   - 5% of session replays (regular sessions)
 *   - 100% of session replays (sessions with an error)
 *
 * What does NOT get captured (by design):
 *   - User passwords (never sent to Sentry)
 *   - TMDB API keys
 *   - DATABASE_URL
 *   - JWT tokens or session cookies
 */
const SENTRY_DSN = process.env.NEXT_PUBLIC_SENTRY_DSN;

if (SENTRY_DSN && SENTRY_DSN.length > 0) {
  Sentry.init({
    dsn: SENTRY_DSN,
    tracesSampleRate: 0.1, // 10% of transactions — enough to spot slow pages
    replaysSessionSampleRate: 0.05, // 5% of normal sessions
    replaysOnErrorSampleRate: 1.0, // 100% of error sessions
    environment: process.env.NODE_ENV,
    // Don't send errors in development — the console is enough there.
    enabled: process.env.NODE_ENV === "production",
    // Scrub sensitive headers and cookies before sending to Sentry.
    beforeSend(event) {
      if (event.request?.headers) {
        const sanitized: Record<string, string> = {};
        for (const [key, value] of Object.entries(event.request.headers)) {
          if (
            key.toLowerCase().includes("auth") ||
            key.toLowerCase().includes("cookie") ||
            key.toLowerCase().includes("password") ||
            key.toLowerCase().includes("token") ||
            key.toLowerCase().includes("secret")
          ) {
            sanitized[key] = "[Filtered]";
          } else {
            sanitized[key] = String(value);
          }
        }
        event.request.headers = sanitized;
      }
      return event;
    },
  });
}
