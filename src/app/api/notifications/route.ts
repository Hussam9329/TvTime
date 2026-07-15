import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getOrCreateUser, parseUserId } from "@/lib/user";

// GET /api/notifications — list user notifications
export async function GET(req: NextRequest) {
  try {
    const user = await getOrCreateUser(parseUserId(req));
    const { searchParams } = new URL(req.url);
    const filter = searchParams.get("filter"); // "unread" | "read" | null
    const where: any = { userId: user.id };
    if (filter === "unread") where.read = false;
    if (filter === "read") where.read = true;
    const notifications = await db.notification.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: 100,
    });
    const unreadCount = await db.notification.count({ where: { userId: user.id, read: false } });
    return NextResponse.json({ notifications, unreadCount });
  } catch (e) {
    console.error("[notifications] GET error:", e);
    return NextResponse.json({ error: "Failed to fetch notifications" }, { status: 500 });
  }
}

// POST /api/notifications — create a notification (mostly for testing/manual)
export async function POST(req: NextRequest) {
  try {
    const user = await getOrCreateUser(parseUserId(req));
    const body = await req.json();
    const { type, title, body: notificationBody, tmdbId, mediaType } = body;
    if (!type || !title || !notificationBody) {
      return NextResponse.json({ error: "type, title, body required" }, { status: 400 });
    }
    const notification = await db.notification.create({
      data: {
        userId: user.id,
        type, title, body: notificationBody,
        tmdbId: tmdbId || null,
        mediaType: mediaType || null,
      },
    });
    return NextResponse.json({ notification });
  } catch (e) {
    console.error("[notifications] POST error:", e);
    return NextResponse.json({ error: "Failed to create notification" }, { status: 500 });
  }
}

// PATCH /api/notifications?id=xxx — mark as read
export async function PATCH(req: NextRequest) {
  try {
    const user = await getOrCreateUser(parseUserId(req));
    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");
    const action = searchParams.get("action"); // "read" | "unread"
    if (action === "all") {
      await db.notification.updateMany({ where: { userId: user.id, read: false }, data: { read: true } });
      return NextResponse.json({ success: true, markedAllRead: true });
    }
    if (!id) return NextResponse.json({ error: "id or action=all required" }, { status: 400 });
    const notification = await db.notification.update({
      where: { id, userId: user.id },
      data: { read: action !== "unread" },
    });
    return NextResponse.json({ notification });
  } catch (e) {
    console.error("[notifications] PATCH error:", e);
    return NextResponse.json({ error: "Failed to update notification" }, { status: 500 });
  }
}

// DELETE /api/notifications?id=xxx — delete a notification (or all)
export async function DELETE(req: NextRequest) {
  try {
    const user = await getOrCreateUser(parseUserId(req));
    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");
    const action = searchParams.get("action");
    if (action === "all") {
      await db.notification.deleteMany({ where: { userId: user.id } });
      return NextResponse.json({ success: true, deletedAll: true });
    }
    if (!id) return NextResponse.json({ error: "id or action=all required" }, { status: 400 });
    await db.notification.delete({ where: { id, userId: user.id } });
    return NextResponse.json({ success: true });
  } catch (e) {
    console.error("[notifications] DELETE error:", e);
    return NextResponse.json({ error: "Failed to delete notification" }, { status: 500 });
  }
}
