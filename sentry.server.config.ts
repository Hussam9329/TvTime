import * as Sentry from "@sentry/nextjs";

/**
 * Sentry server-side initialization (Node.js runtime — API routes,
 * server components, getServerSideProps).
 *
 * Same opt-in pattern as sentry.client.config.ts: only activates when
 * SENTRY_DSN is set. Uses the non-public env var (no NEXT_PUBLIC_ prefix)
 * because the server DSN should not be exposed to the browser.
 *
 * Server-side captures:
 *   - Unhandled errors in API routes (e.g. /api/tv-tracking throwing)
 *   - Database query failures
 *   - TMDB timeout errors (added in the timeout step)
 *   - 10% of server-side performance transactions
 */
const SENTRY_DSN = process.env.SENTRY_DSN;

if (SENTRY_DSN && SENTRY_DSN.length > 0) {
  Sentry.init({
    dsn: SENTRY_DSN,
    tracesSampleRate: 0.1,
    environment: process.env.NODE_ENV,
    enabled: process.env.NODE_ENV === "production",
    // Scrub sensitive data from server events.
    beforeSend(event) {
      // Remove request bodies that might contain passwords or tokens.
      if (event.request?.data) {
        event.request.data = "[Filtered]";
      }
      return event;
    },
  });
}
