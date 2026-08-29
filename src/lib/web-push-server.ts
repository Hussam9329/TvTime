import { createECDH, timingSafeEqual } from "node:crypto";
import { importJWK, SignJWT } from "jose";
import { db } from "@/lib/db";
import {
  decodeBase64Url,
  validPushEndpoint,
  validVapidSubject,
} from "@/lib/web-push-policy";
import { encryptWebPushPayload } from "@/lib/web-push-crypto";

export type PushPayload = {
  title: string;
  body: string;
  url?: string;
  tag?: string;
};

type StoredSubscription = {
  id: string;
  endpoint: string;
  p256dh: string;
  auth: string;
};

function base64UrlToBuffer(value: string): Buffer {
  const decoded = decodeBase64Url(value);
  if (!decoded) throw new Error("Invalid base64url value");
  return decoded;
}

function bufferToBase64Url(value: Buffer | Uint8Array): string {
  return Buffer.from(value).toString("base64url");
}

function vapidConfig() {
  const publicKey = String(process.env.VAPID_PUBLIC_KEY || "").trim();
  const privateKey = String(process.env.VAPID_PRIVATE_KEY || "").trim();
  const subject = String(process.env.VAPID_SUBJECT || "").trim();
  try {
    const publicBytes = base64UrlToBuffer(publicKey);
    const privateBytes = base64UrlToBuffer(privateKey);
    if (publicBytes.length !== 65 || publicBytes[0] !== 4 || privateBytes.length !== 32 || !validVapidSubject(subject)) return null;
    const pair = createECDH("prime256v1");
    pair.setPrivateKey(privateBytes);
    const derivedPublic = pair.getPublicKey();
    if (derivedPublic.length !== publicBytes.length || !timingSafeEqual(derivedPublic, publicBytes)) return null;
    return { publicKey, privateKey, subject, publicBytes, privateBytes };
  } catch {
    return null;
  }
}

export function getVapidPublicKey(): string | null {
  return vapidConfig()?.publicKey ?? null;
}

async function vapidAuthorization(endpoint: string, config: NonNullable<ReturnType<typeof vapidConfig>>): Promise<string> {
  const audience = new URL(endpoint).origin;
  const x = bufferToBase64Url(config.publicBytes.subarray(1, 33));
  const y = bufferToBase64Url(config.publicBytes.subarray(33, 65));
  const d = bufferToBase64Url(config.privateBytes);
  const key = await importJWK({ kty: "EC", crv: "P-256", x, y, d }, "ES256");
  const token = await new SignJWT({})
    .setProtectedHeader({ alg: "ES256", typ: "JWT" })
    .setAudience(audience)
    .setSubject(config.subject)
    .setIssuedAt()
    .setExpirationTime(Math.floor(Date.now() / 1000) + 12 * 60 * 60)
    .sign(key);
  return `vapid t=${token}, k=${config.publicKey}`;
}

async function sendOne(subscription: StoredSubscription, payload: PushPayload, config: NonNullable<ReturnType<typeof vapidConfig>>) {
  if (!validPushEndpoint(subscription.endpoint)) throw new Error("Untrusted push endpoint");
  const body = encryptWebPushPayload(payload, subscription.p256dh, subscription.auth);
  const authorization = await vapidAuthorization(subscription.endpoint, config);
  const response = await fetch(subscription.endpoint, {
    method: "POST",
    headers: {
      Authorization: authorization,
      "Content-Encoding": "aes128gcm",
      "Content-Type": "application/octet-stream",
      TTL: "86400",
      Urgency: "normal",
    },
    body: new Uint8Array(body),
    signal: AbortSignal.timeout(15_000),
    redirect: "error",
  });
  if (response.status === 404 || response.status === 410) {
    await db.pushSubscription.delete({ where: { id: subscription.id } }).catch(() => undefined);
    return false;
  }
  if (!response.ok) throw new Error(`Push endpoint returned ${response.status}`);
  return true;
}

async function mapLimit<T>(items: T[], limit: number, worker: (item: T) => Promise<void>): Promise<void> {
  let cursor = 0;
  async function run() {
    while (true) {
      const index = cursor++;
      if (index >= items.length) return;
      await worker(items[index]);
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, run));
}

export async function sendPushToUser(userId: string, payload: PushPayload): Promise<{ sent: number; failed: number; enabled: boolean }> {
  const config = vapidConfig();
  if (!config) return { sent: 0, failed: 0, enabled: false };
  const subscriptions = await db.pushSubscription.findMany({
    where: { userId },
    select: { id: true, endpoint: true, p256dh: true, auth: true },
  });
  let sent = 0;
  let failed = 0;
  await mapLimit(subscriptions, 8, async (subscription) => {
    try {
      if (await sendOne(subscription, payload, config)) sent += 1;
    } catch (error) {
      failed += 1;
      console.warn("[web-push] delivery failed", { subscriptionId: subscription.id, error });
    }
  });
  return { sent, failed, enabled: true };
}
