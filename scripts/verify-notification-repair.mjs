#!/usr/bin/env node
import { readFileSync } from "node:fs";

const failures = [];
const read = (path) => readFileSync(path, "utf8");
const requireText = (path, pattern, message) => {
  if (!pattern.test(read(path))) failures.push(`${path}: ${message}`);
};
const rejectText = (path, pattern, message) => {
  if (pattern.test(read(path))) failures.push(`${path}: ${message}`);
};

const route = "src/app/api/notifications/sync/route.ts";
const service = "src/lib/notification-sync-server.ts";
const push = "src/lib/web-push-server.ts";
const pushCrypto = "src/lib/web-push-crypto.ts";
const subscription = "src/app/api/notifications/push/subscriptions/route.ts";
const cron = "src/app/api/cron/notifications/route.ts";
const migration = "prisma/migrations/20260829010000_web_push_subscriptions/migration.sql";
const worker = "public/sw.js";
const publicKey = "src/app/api/notifications/push/public-key/route.ts";

requireText(route, /resolveUserId\(req\)[\s\S]*syncNotificationsForUser\(user\.id/, "sync route must resolve the authenticated user and delegate to the shared service");
requireText(service, /!canReconcileEpisodeBacklog\(current\)\)\s*continue/, "unreliable TMDB episode boundaries must not reconcile or erase alerts");
requireText("src/lib/notification-sync-policy.ts", /airedEpisodeInferenceReliable\s*===\s*true/, "episode reconciliation reliability must fail closed");
requireText(service, /updateMany\([\s\S]*createdAt:\s*keeper\.createdAt/, "backlog wakeups need an optimistic concurrency claim");
requireText(service, /deleteMany\([\s\S]*rows\.slice\(1\)/, "duplicate consolidation must be idempotent under concurrent syncs");
requireText(service, /ONGOING_NOTIFICATION_REFRESH_MS\s*=\s*60\s*\*\s*60\s*\*\s*1000/, "ongoing metadata refresh cadence is missing");
requireText(service, /refreshEnded\s*&&\s*row\.fetchedAt\s*<=\s*endedCutoff/, "ended shows must only be refreshed by the bounded weekly path");
requireText(service, /url:\s*`\/tv\/\$\{pushEvents\[0\]\.tmdbId\}`/, "single-title push must deep-link to the TV detail page");

requireText(push, /timingSafeEqual\(derivedPublic,\s*publicBytes\)/, "configured VAPID public/private keys must be verified as one pair");
requireText(push, /validPushEndpoint\(subscription\.endpoint\)/, "delivery must revalidate the endpoint trust boundary");
requireText(push, /AbortSignal\.timeout\(15_000\)/, "push delivery needs a bounded network timeout");
requireText(push, /redirect:\s*"error"/, "push delivery must not follow redirects outside the trusted endpoint boundary");
requireText(push, /mapLimit\(subscriptions,\s*8/, "push fan-out must have bounded concurrency");
rejectText(push, /console\.(?:warn|error)\([^\n]*subscription\.endpoint/, "logs must not disclose full push endpoints");
requireText("src/lib/web-push-policy.ts", /ECDH\.convertKey\([\s\S]*"prime256v1"/, "subscriber public keys must be validated as real P-256 curve points");
requireText(pushCrypto, /MAX_WEB_PUSH_PAYLOAD_BYTES\s*=\s*3_993/, "encrypted push payloads must remain within the standard Web Push service limit");
requireText(pushCrypto, /WebPush: info\\0[\s\S]*Content-Encoding: aes128gcm\\0[\s\S]*Content-Encoding: nonce\\0/, "Web Push encryption must retain the RFC 8291 derivation labels");
requireText(subscription, /existing\.userId\s*!==\s*user\.id[\s\S]*status:\s*409/, "a subscription endpoint must never transfer between users");
requireText(subscription, /validPushEndpoint\(endpoint\)[\s\S]*validP256dh\(p256dh\)[\s\S]*validAuthSecret\(auth\)/, "subscription inputs must be strictly validated");
requireText(subscription, /MAX_SUBSCRIPTION_BODY_BYTES\s*=\s*16_384[\s\S]*req\.body\.getReader\(\)/, "subscription bodies need a streaming size bound even without Content-Length");
requireText(publicKey, /dynamic\s*=\s*"force-dynamic"/, "the VAPID public-key response must be evaluated at runtime");
requireText(publicKey, /Cache-Control["']:\s*["']private, no-store/, "the VAPID public-key response must be no-store");
requireText("src/components/profile/profile-dialog.tsx", /applicationServerKeysEqual\(subscription\.options\.applicationServerKey,\s*requestedKey\)/, "the profile must detect subscriptions created with an obsolete VAPID key");

requireText(cron, /timingSafeEqual\(expectedBytes,\s*providedBytes\)/, "cron authentication must use a timing-safe comparison");
requireText(cron, /secret\.length\s*<\s*24/, "cron secret must enforce a minimum length");
requireText(cron, /dynamic\s*=\s*"force-dynamic"/, "cron response must never be statically cached");
requireText(cron, /Cache-Control["']:\s*["']private, no-store/, "cron response must be no-store");

requireText(worker, /addEventListener\("push"[\s\S]*event\.waitUntil/, "service worker must keep real push delivery alive");
requireText(worker, /safeNotificationTarget[\s\S]*target\.origin\s*===\s*self\.location\.origin/, "notification click targets must remain same-origin");

requireText(migration, /CREATE TABLE IF NOT EXISTS "PushSubscription"/, "migration must create the push subscription table additively");
requireText(migration, /ENABLE ROW LEVEL SECURITY[\s\S]*push_subscription_isolate_own_rows/, "push subscriptions require per-user RLS");
requireText(migration, /PushSubscription_endpoint_length_check/, "endpoint length must be constrained in the database");
requireText(migration, /PushSubscription_key_shape_check/, "subscription key shape must be constrained in the database");
requireText(migration, /RAISE EXCEPTION[\s\S]*incomplete rows/, "partial-schema reconciliation must fail closed");
rejectText(migration, /\b(?:DELETE\s+FROM|TRUNCATE|DROP\s+TABLE|DROP\s+COLUMN)\b/i, "notification migration contains a destructive data/table operation");

if (failures.length > 0) {
  for (const failure of failures) console.error(`FAIL: ${failure}`);
  process.exit(1);
}
console.log("PASS: notification repair security, concurrency and deployment guards");
