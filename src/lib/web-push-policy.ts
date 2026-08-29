import { ECDH } from "node:crypto";

const EXACT_PUSH_HOSTS = new Set([
  "fcm.googleapis.com",
  "push.services.mozilla.com",
  "updates.push.services.mozilla.com",
  "web.push.apple.com",
]);

const PUSH_HOST_SUFFIXES = [
  ".push.services.mozilla.com",
  ".notify.windows.com",
];

export function decodeBase64Url(value: string): Buffer | null {
  const normalized = String(value || "").trim();
  if (!normalized || normalized.length > 512 || !/^[A-Za-z0-9_-]+$/.test(normalized)) return null;
  try {
    const decoded = Buffer.from(normalized, "base64url");
    return decoded.toString("base64url") === normalized ? decoded : null;
  } catch {
    return null;
  }
}

export function validP256dh(value: unknown): value is string {
  if (typeof value !== "string") return false;
  const decoded = decodeBase64Url(value);
  if (decoded?.length !== 65 || decoded[0] !== 4) return false;
  try {
    const normalized = ECDH.convertKey(decoded, "prime256v1", undefined, undefined, "uncompressed");
    return normalized.equals(decoded);
  } catch {
    return false;
  }
}

export function validAuthSecret(value: unknown): value is string {
  if (typeof value !== "string") return false;
  return decodeBase64Url(value)?.length === 16;
}

export function validPushEndpoint(value: unknown): value is string {
  if (typeof value !== "string" || value.length < 20 || value.length > 4096) return false;
  try {
    const url = new URL(value);
    const host = url.hostname.toLowerCase();
    if (url.protocol !== "https:" || url.username || url.password || url.port) return false;
    if (!url.pathname || url.pathname === "/") return false;
    return EXACT_PUSH_HOSTS.has(host) || PUSH_HOST_SUFFIXES.some((suffix) => host.endsWith(suffix));
  } catch {
    return false;
  }
}

export function validVapidSubject(value: string): boolean {
  try {
    const url = new URL(value);
    if (url.protocol === "https:") return Boolean(url.hostname);
    return url.protocol === "mailto:" && /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(url.pathname);
  } catch {
    return false;
  }
}
