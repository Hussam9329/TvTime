import { NextRequest, NextResponse } from "next/server";
import { getOrCreateUser } from "@/lib/user";
import { resolveUserId } from "@/lib/auth";
import { syncNotificationsForUser } from "@/lib/notification-sync-server";

export const maxDuration = 300;

export async function POST(req: NextRequest) {
  try {
    const user = await getOrCreateUser(await resolveUserId(req));
    const result = await syncNotificationsForUser(user.id, { sendPush: true });
    return NextResponse.json(result, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    console.error("[notifications:sync]", error);
    return NextResponse.json({ error: "Failed to sync notifications" }, { status: 500 });
  }
}
