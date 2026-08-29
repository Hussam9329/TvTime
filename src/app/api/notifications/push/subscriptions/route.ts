import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { resolveUserId } from "@/lib/auth";
import { getOrCreateUser } from "@/lib/user";
import { validAuthSecret, validP256dh, validPushEndpoint } from "@/lib/web-push-policy";

const MAX_SUBSCRIPTION_BODY_BYTES = 16_384;

class RequestBodyTooLargeError extends Error {}

async function readSubscriptionBody(req: NextRequest): Promise<unknown> {
  const contentLength = Number(req.headers.get("content-length") || 0);
  if (Number.isFinite(contentLength) && contentLength > MAX_SUBSCRIPTION_BODY_BYTES) {
    throw new RequestBodyTooLargeError();
  }
  if (!req.body) return {};
  const reader = req.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > MAX_SUBSCRIPTION_BODY_BYTES) {
      await reader.cancel();
      throw new RequestBodyTooLargeError();
    }
    chunks.push(value);
  }
  const bytes = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return JSON.parse(new TextDecoder().decode(bytes));
}

export async function POST(req: NextRequest) {
  try {
    const user = await getOrCreateUser(await resolveUserId(req));
    const body = await readSubscriptionBody(req) as { endpoint?: unknown; keys?: { p256dh?: unknown; auth?: unknown } };
    const endpoint = body?.endpoint;
    const p256dh = body?.keys?.p256dh;
    const auth = body?.keys?.auth;
    if (!validPushEndpoint(endpoint) || !validP256dh(p256dh) || !validAuthSecret(auth)) {
      return NextResponse.json({ error: "Invalid push subscription" }, { status: 400 });
    }

    const existing = await db.pushSubscription.findUnique({ where: { endpoint }, select: { userId: true } });
    if (existing && existing.userId !== user.id) {
      return NextResponse.json({ error: "Push subscription belongs to another account" }, { status: 409 });
    }
    if (existing) {
      await db.pushSubscription.updateMany({
        where: { endpoint, userId: user.id },
        data: { p256dh, auth },
      });
    } else {
      try {
        await db.pushSubscription.create({ data: { userId: user.id, endpoint, p256dh, auth } });
      } catch (error) {
        // Close the small create race without ever transferring ownership.
        const raced = await db.pushSubscription.findUnique({ where: { endpoint }, select: { userId: true } });
        if (!raced || raced.userId !== user.id) throw error;
        await db.pushSubscription.updateMany({
          where: { endpoint, userId: user.id },
          data: { p256dh, auth },
        });
      }
    }
    return NextResponse.json({ success: true });
  } catch (error) {
    if (error instanceof RequestBodyTooLargeError) {
      return NextResponse.json({ error: "Push subscription is too large" }, { status: 413 });
    }
    if (error instanceof SyntaxError) {
      return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
    }
    console.error("[push-subscription] POST", error);
    return NextResponse.json({ error: "Failed to save push subscription" }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const user = await getOrCreateUser(await resolveUserId(req));
    const body = await readSubscriptionBody(req) as { endpoint?: unknown };
    const endpoint = body?.endpoint;
    if (!validPushEndpoint(endpoint)) return NextResponse.json({ error: "Invalid endpoint" }, { status: 400 });
    await db.pushSubscription.deleteMany({ where: { userId: user.id, endpoint } });
    return NextResponse.json({ success: true });
  } catch (error) {
    if (error instanceof RequestBodyTooLargeError) {
      return NextResponse.json({ error: "Push subscription is too large" }, { status: 413 });
    }
    if (error instanceof SyntaxError) {
      return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
    }
    console.error("[push-subscription] DELETE", error);
    return NextResponse.json({ error: "Failed to remove push subscription" }, { status: 500 });
  }
}
