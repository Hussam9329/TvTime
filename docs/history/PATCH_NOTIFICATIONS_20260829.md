# Notifications system repair — 2026-08-29

This patch repairs the notification pipeline end-to-end.

## What changed

- Stale followed-TV metadata is refreshed through TMDB before notification decisions are made.
- Ongoing shows refresh when stale; ended shows reuse stable cache and are force-rechecked weekly by the cron path.
- Daily `new_episode` / `backlog_alert` spam is collapsed to one current-state notification per show.
- A backlog notification is only re-awakened when the missing episode count increases or fresh metadata proves a newly released episode appeared.
- Existing duplicate daily notifications are consolidated automatically on the first sync.
- Concurrent browser/cron syncs use deterministic inserts and optimistic wake-up claims, so one episode event produces at most one push attempt.
- Daily notification bodies are Arabic and notification body/title elements use safe direction handling.
- `/api/notifications` now returns exact `all / unread / read` counts and paginates the list instead of presenting the first 100 rows as the total.
- The notification center can load all pages with "تحميل المزيد".
- A real server-side Web Push pipeline was added using the existing `jose` dependency + Node crypto (no new package dependency).
- Browser push subscriptions are persisted in the new `PushSubscription` table.
- Subscription ownership cannot be transferred across accounts, and malformed keys are rejected before they reach the database.
- Push delivery accepts only known Apple, Google, Mozilla and Microsoft HTTPS services, refuses redirects, validates the VAPID key pair, and uses bounded concurrency and timeouts.
- The service worker handles real `push` events, so delivery does not require an open tab.
- Notification click URLs are constrained to this site's origin; a single-title alert opens that TV detail page directly.
- A protected Vercel Cron endpoint refreshes metadata, performs catch-up notification sync, and sends Web Push.
- The migration is additive and fail-closed: unexpected partial rows or duplicate identities abort the transaction without deleting subscription data.

## Required production setup

1. Apply the additive database migration before deploying the application build:

   `npm run db:migrate:deploy`

2. Generate one VAPID key pair locally:

   `node scripts/generate-vapid-keys.mjs`

3. Add these Vercel Production environment variables from that output:

   - `VAPID_PUBLIC_KEY`
   - `VAPID_PRIVATE_KEY`
   - `VAPID_SUBJECT` (the generator uses the deployed HTTPS origin; a real `mailto:` contact is also valid)

4. Add a random `CRON_SECRET` with at least 24 characters in Vercel Production.

5. Deploy, then open Profile > Install & notifications once on each device and enable background notifications.

## Cron cadence

`vercel.json` uses `15 0 * * *` (daily, 00:15 UTC). This is deliberately compatible with Vercel Hobby's daily Cron limit. The normal in-app sync still runs every 15 minutes while the site is open. Notification-specific TMDB refreshes are limited to once per hour for ongoing titles; ended titles are rechecked on the weekly Sunday cron path. Crossing a cached next-episode air date still triggers an immediate refresh. On a Vercel plan that supports more frequent Cron execution, the schedule can be increased separately.

## Data behavior

The patch does not delete library, watch progress, ratings, or followed shows. During notification sync it intentionally removes redundant duplicate daily backlog/new-episode rows for the same followed show, and removes series notifications that no longer belong to an actively followed/notified title. If TMDB cannot prove the released-episode boundary, the sync preserves the existing alert instead of reconciling from incomplete metadata.

## Verification

- `npm run verify:notifications` runs pure behavior tests plus static security, concurrency, migration and deployment guards.
- `npm run verify:all` includes those notification checks in the maintained project-wide verification suite.
- GitHub's schema workflow applies the complete migration chain to an empty PostgreSQL 16 database and builds the application against it.
