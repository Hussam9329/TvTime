import assert from "node:assert/strict";
import { createDecipheriv, createECDH, hkdfSync, randomBytes } from "node:crypto";
import {
  backlogBody,
  canReconcileEpisodeBacklog,
  parseBacklogCount,
  releasedEpisodeDelta,
  shouldWakeBacklog,
} from "../src/lib/notification-sync-policy.ts";
import {
  decodeBase64Url,
  validAuthSecret,
  validP256dh,
  validPushEndpoint,
  validVapidSubject,
} from "../src/lib/web-push-policy.ts";
import { encryptWebPushPayload } from "../src/lib/web-push-crypto.ts";

const snapshot = (keys: string[], reliable = true) => ({
  airedEpisodeKeys: new Set(keys),
  airedEpisodeInferenceReliable: reliable,
});

assert.equal(parseBacklogCount("new_episode", "ignored"), 1);
assert.equal(parseBacklogCount("backlog_alert", "لديك 12 حلقة"), 12);
assert.equal(parseBacklogCount("backlog_alert", "لديك ١٢ حلقة"), 12);
assert.equal(parseBacklogCount("backlog_alert", "لديك ۱۲ حلقة"), 12);
assert.equal(parseBacklogCount("backlog_alert", "لا يوجد رقم"), 0);
assert.equal(backlogBody(1), "لديك حلقة متاحة بانتظار المشاهدة.");
assert.equal(backlogBody(3), "لديك 3 حلقات متاحة بانتظار المشاهدة.");

assert.equal(canReconcileEpisodeBacklog(snapshot(["1-1"])), true);
assert.equal(canReconcileEpisodeBacklog(snapshot(["1-1"], false)), false);
assert.equal(canReconcileEpisodeBacklog(undefined), false);
assert.equal(releasedEpisodeDelta(snapshot(["1-1"]), snapshot(["1-1", "1-2", "1-3"])), 2);
assert.equal(releasedEpisodeDelta(snapshot(["1-1"], false), snapshot(["1-1", "1-2"])), 0);
assert.equal(shouldWakeBacklog({ hasExisting: false, previousMissingCount: 0, missingCount: 1, newlyReleasedCount: 0 }), true);
assert.equal(shouldWakeBacklog({ hasExisting: true, previousMissingCount: 2, missingCount: 2, newlyReleasedCount: 0 }), false);
assert.equal(shouldWakeBacklog({ hasExisting: true, previousMissingCount: 2, missingCount: 1, newlyReleasedCount: 0 }), false);
assert.equal(shouldWakeBacklog({ hasExisting: true, previousMissingCount: 1, missingCount: 2, newlyReleasedCount: 0 }), true);
assert.equal(shouldWakeBacklog({ hasExisting: true, previousMissingCount: 2, missingCount: 2, newlyReleasedCount: 1 }), true);

for (const endpoint of [
  "https://fcm.googleapis.com/fcm/send/example-subscription",
  "https://updates.push.services.mozilla.com/wpush/v2/example-subscription",
  "https://web.push.apple.com/QP/example-subscription",
  "https://db5.notify.windows.com/w/?token=example-subscription",
]) {
  assert.equal(validPushEndpoint(endpoint), true, `trusted endpoint rejected: ${endpoint}`);
}
for (const endpoint of [
  "http://fcm.googleapis.com/fcm/send/example-subscription",
  "https://localhost/push/example-subscription",
  "https://127.0.0.1/push/example-subscription",
  "https://example.com/push/example-subscription",
  "https://user:pass@fcm.googleapis.com/fcm/send/example-subscription",
  "https://fcm.googleapis.com:444/fcm/send/example-subscription",
  "https://fcm.googleapis.com/",
  "https://evilfcm.googleapis.com/push/example-subscription",
  "not-a-url",
]) {
  assert.equal(validPushEndpoint(endpoint), false, `untrusted endpoint accepted: ${endpoint}`);
}

const subscriberKey = createECDH("prime256v1");
subscriberKey.generateKeys();
const p256dh = subscriberKey.getPublicKey().toString("base64url");
const auth = randomBytes(16).toString("base64url");
assert.equal(validP256dh(p256dh), true);
assert.equal(validP256dh(Buffer.concat([Buffer.from([4]), Buffer.alloc(64)]).toString("base64url")), false);
assert.equal(validAuthSecret(auth), true);
assert.equal(validAuthSecret(randomBytes(15).toString("base64url")), false);
assert.deepEqual(decodeBase64Url(auth), Buffer.from(auth, "base64url"));
assert.equal(decodeBase64Url(`${auth}=`), null, "padded/non-canonical base64url must be rejected");

assert.equal(validVapidSubject("https://tvtime-iota.vercel.app/"), true);
assert.equal(validVapidSubject("mailto:owner@example.com"), true);
assert.equal(validVapidSubject("mailto:not-an-address"), false);
assert.equal(validVapidSubject("javascript:alert(1)"), false);

const payload = { title: "Trakora", body: "حلقة جديدة", url: "/tv/42", tag: "tv-42" };
const encryptedPayload = encryptWebPushPayload(payload, p256dh, auth);
const salt = encryptedPayload.subarray(0, 16);
assert.equal(encryptedPayload.readUInt32BE(16), 4096);
const serverKeyLength = encryptedPayload[20];
assert.equal(serverKeyLength, 65);
const serverPublicKey = encryptedPayload.subarray(21, 21 + serverKeyLength);
const ciphertextAndTag = encryptedPayload.subarray(21 + serverKeyLength);
const sharedSecret = subscriberKey.computeSecret(serverPublicKey);
const keyInfo = Buffer.concat([
  Buffer.from("WebPush: info\0", "utf8"),
  subscriberKey.getPublicKey(),
  serverPublicKey,
]);
const ikm = Buffer.from(hkdfSync("sha256", sharedSecret, Buffer.from(auth, "base64url"), keyInfo, 32));
const contentKey = Buffer.from(hkdfSync("sha256", ikm, salt, Buffer.from("Content-Encoding: aes128gcm\0"), 16));
const nonce = Buffer.from(hkdfSync("sha256", ikm, salt, Buffer.from("Content-Encoding: nonce\0"), 12));
const decipher = createDecipheriv("aes-128-gcm", contentKey, nonce);
decipher.setAuthTag(ciphertextAndTag.subarray(-16));
const plaintext = Buffer.concat([
  decipher.update(ciphertextAndTag.subarray(0, -16)),
  decipher.final(),
]);
assert.equal(plaintext.at(-1), 2, "aes128gcm payload must end with the final-record delimiter");
assert.deepEqual(JSON.parse(plaintext.subarray(0, -1).toString("utf8")), payload);
assert.throws(
  () => encryptWebPushPayload({ body: "x".repeat(5_000) }, p256dh, auth),
  /too large/,
);

console.log("PASS: notification reconciliation, Web Push trust policy and aes128gcm encryption");
