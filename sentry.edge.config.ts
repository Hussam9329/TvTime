import * as Sentry from "@sentry/nextjs";

/**
 * Sentry Edge runtime initialization (middleware, edge API routes).
 *
 * Same opt-in pattern: only activates when SENTRY_DSN is set.
 */
const SENTRY_DSN = process.env.SENTRY_DSN;

if (SENTRY_DSN && SENTRY_DSN.length > 0) {
  Sentry.init({
    dsn: SENTRY_DSN,
    tracesSampleRate: 0.1,
    environment: process.env.NODE_ENV,
    enabled: process.env.NODE_ENV === "production",
  });
}
