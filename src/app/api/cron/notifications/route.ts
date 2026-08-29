import { timingSafeEqual } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { syncNotificationsForUser } from "@/lib/notification-sync-server";

export const maxDuration = 300;
export const dynamic = "force-dynamic";

function authorized(req: NextRequest): boolean {
  const secret = String(process.env.CRON_SECRET || "").trim();
  const provided = String(req.headers.get("authorization") || "").replace(/^Bearer\s+/i, "");
  const expectedBytes = Buffer.from(secret);
  const providedBytes = Buffer.from(provided);
  if (secret.length < 24 || providedBytes.length !== expectedBytes.length) return false;
  return timingSafeEqual(expectedBytes, providedBytes);
}

export async function GET(req: NextRequest) {
  if (!authorized(req)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const users = await db.media.findMany({
    where: { type: "series", isFollowing: true, tmdbId: { not: null }, OR: [{ notifyOnNewEpisode: null }, { notifyOnNewEpisode: true }] },
    distinct: ["userId"],
    select: { userId: true },
  });
  const results = [];
  for (const { userId } of users) {
    try {
      results.push({ userId, ...(await syncNotificationsForUser(userId, { sendPush: true, refreshEnded: new Date().getUTCDay() === 0 })) });
    } catch (error) {
      console.error("[notifications-cron] user failed", userId, error);
      results.push({ userId, error: "sync_failed" });
    }
  }
  return NextResponse.json(
    { ok: true, users: results.length, results },
    { headers: { "Cache-Control": "private, no-store" } },
  );
}
