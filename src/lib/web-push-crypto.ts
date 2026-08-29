import { createCipheriv, createECDH, hkdfSync, randomBytes } from "node:crypto";
import { validAuthSecret, validP256dh } from "@/lib/web-push-policy";

// 4,096-byte service limit minus the aes128gcm header, delimiter and tag.
const MAX_WEB_PUSH_PAYLOAD_BYTES = 3_993;

function decodeRequiredBase64Url(value: string): Buffer {
  return Buffer.from(value, "base64url");
}

export function encryptWebPushPayload(payload: unknown, userPublicKey: string, authSecret: string): Buffer {
  if (!validP256dh(userPublicKey) || !validAuthSecret(authSecret)) {
    throw new Error("Invalid push subscription keys");
  }
  const json = JSON.stringify(payload);
  if (!json) throw new Error("Push payload is not serializable");
  const jsonBytes = Buffer.from(json, "utf8");
  if (jsonBytes.length > MAX_WEB_PUSH_PAYLOAD_BYTES) {
    throw new Error("Push payload is too large for one aes128gcm record");
  }

  const clientPublic = decodeRequiredBase64Url(userPublicKey);
  const auth = decodeRequiredBase64Url(authSecret);
  const server = createECDH("prime256v1");
  server.generateKeys();
  const serverPublic = server.getPublicKey();
  const sharedSecret = server.computeSecret(clientPublic);
  const keyInfo = Buffer.concat([
    Buffer.from("WebPush: info\0", "utf8"),
    clientPublic,
    serverPublic,
  ]);
  const ikm = Buffer.from(hkdfSync("sha256", sharedSecret, auth, keyInfo, 32));
  const salt = randomBytes(16);
  const contentKey = Buffer.from(hkdfSync("sha256", ikm, salt, Buffer.from("Content-Encoding: aes128gcm\0"), 16));
  const nonce = Buffer.from(hkdfSync("sha256", ikm, salt, Buffer.from("Content-Encoding: nonce\0"), 12));
  const plaintext = Buffer.concat([jsonBytes, Buffer.from([2])]);
  const cipher = createCipheriv("aes-128-gcm", contentKey, nonce);
  const encrypted = Buffer.concat([cipher.update(plaintext), cipher.final(), cipher.getAuthTag()]);
  const recordSize = Buffer.alloc(4);
  recordSize.writeUInt32BE(4096, 0);
  return Buffer.concat([salt, recordSize, Buffer.from([serverPublic.length]), serverPublic, encrypted]);
}
