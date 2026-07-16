/**
 * Simple in-memory rate limiter for the login endpoint.
 *
 * Why in-memory (not Redis): this is a single-user personal app. Vercel
 * serverless recycles instances, but an attacker would need to hit the
 * SAME instance repeatedly to be limited — which is exactly the pattern
 * of a brute-force attack (rapid requests from one IP). A distributed
 * attacker would still be slowed by the per-request 400ms delay in the
 * login handler.
 *
 * For a multi-user app, replace this with @upstash/ratelimit + Redis.
 *
 * Limits:
 * - 5 failed attempts per IP within a 15-minute window
 * - After 5 failures, the IP is blocked for 15 minutes
 * - Successful logins don't count toward the limit
 * - The window slides: each failure resets the 15-minute block
 */

type AttemptRecord = {
  failures: number;
  firstFailureAt: number;
  blockedUntil: number;
};

const WINDOW_MS = 15 * 60 * 1000; // 15 minutes
const MAX_FAILURES = 5;
const BLOCK_MS = 15 * 60 * 1000; // 15 minutes block

// Map<ip, AttemptRecord>. Unbounded growth is bounded in practice because:
// 1) Vercel recycles instances every few minutes, clearing the map
// 2) We prune entries older than 2× WINDOW_MS on every check
const attempts = new Map<string, AttemptRecord>();

function pruneOldEntries(now: number) {
  const cutoff = now - 2 * WINDOW_MS;
  for (const [ip, record] of attempts) {
    if (record.firstFailureAt < cutoff && record.blockedUntil < now) {
      attempts.delete(ip);
    }
  }
}

/**
 * Check if an IP is currently blocked. Returns the remaining block time
 * in milliseconds, or null if not blocked.
 */
export function getRemainingBlockTime(ip: string): number | null {
  const now = Date.now();
  pruneOldEntries(now);
  const record = attempts.get(ip);
  if (!record || record.blockedUntil <= now) return null;
  return record.blockedUntil - now;
}

/**
 * Record a failed login attempt. If the IP exceeds MAX_FAILURES within
 * the window, it gets blocked for BLOCK_MS.
 */
export function recordFailedAttempt(ip: string): { blocked: boolean; remainingAttempts: number } {
  const now = Date.now();
  pruneOldEntries(now);

  const existing = attempts.get(ip);
  if (!existing || existing.firstFailureAt < now - WINDOW_MS) {
    // Start a new window
    attempts.set(ip, {
      failures: 1,
      firstFailureAt: now,
      blockedUntil: 0,
    });
    return { blocked: false, remainingAttempts: MAX_FAILURES - 1 };
  }

  existing.failures += 1;
  if (existing.failures >= MAX_FAILURES) {
    existing.blockedUntil = now + BLOCK_MS;
    attempts.set(ip, existing);
    return { blocked: true, remainingAttempts: 0 };
  }

  attempts.set(ip, existing);
  return { blocked: false, remainingAttempts: MAX_FAILURES - existing.failures };
}

/**
 * Clear the attempt history for an IP (called on successful login).
 * This prevents a slow accumulation of failures from locking out a
 * legitimate user who occasionally mistypes their password.
 */
export function clearAttempts(ip: string) {
  attempts.delete(ip);
}

/**
 * Extract the client IP from a Next.js request. Vercel sets
 * `x-forwarded-for` (and `x-real-ip` as a fallback).
 */
export function getClientIp(req: Request): string {
  const forwarded = req.headers.get("x-forwarded-for");
  if (forwarded) {
    // x-forwarded-for can be a comma-separated list; the first entry is
    // the original client IP.
    return forwarded.split(",")[0].trim();
  }
  const realIp = req.headers.get("x-real-ip");
  if (realIp) return realIp.trim();
  return "unknown";
}
