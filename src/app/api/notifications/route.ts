import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getOrCreateUser } from "@/lib/user";
import { resolveUserId } from "@/lib/auth";
import type { Prisma } from "@prisma/client";

const MAX_PAGE_SIZE = 100;
const MAX_OFFSET = 1_000_000;
const NOTIFICATION_TYPES = new Set([
  "new_episode",
  "movie_available",
  "season_return",
  "season_premiere",
  "season_finale",
  "backlog_alert",
]);

function boundedInteger(value: string | null, fallback: number, minimum: number, maximum: number): number {
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed)) return fallback;
  return Math.min(maximum, Math.max(minimum, parsed));
}

async function notificationCounts(userId: string) {
  const [all, unread] = await Promise.all([
    db.notification.count({ where: { userId } }),
    db.notification.count({ where: { userId, read: false } }),
  ]);
  return { all, unread, read: Math.max(0, all - unread) };
}

// GET /api/notifications — exact counts + paginated notification list.
export async function GET(req: NextRequest) {
  try {
    const user = await getOrCreateUser(await resolveUserId(req));
    const { searchParams } = new URL(req.url);
    const filter = searchParams.get("filter");
    const countOnly = searchParams.get("countOnly") === "true";
    const counts = await notificationCounts(user.id);
    if (countOnly) {
      return NextResponse.json(
        { unreadCount: counts.unread, counts },
        { headers: { "Cache-Control": "private, no-store" } },
      );
    }

    const limit = boundedInteger(searchParams.get("limit"), MAX_PAGE_SIZE, 1, MAX_PAGE_SIZE);
    const offset = boundedInteger(searchParams.get("offset"), 0, 0, MAX_OFFSET);
    const where: Prisma.NotificationWhereInput = { userId: user.id };
    if (filter === "unread") where.read = false;
    if (filter === "read") where.read = true;
    const total = filter === "unread" ? counts.unread : filter === "read" ? counts.read : counts.all;
    const notifications = await db.notification.findMany({
      where,
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      skip: offset,
      take: limit,
    });
    return NextResponse.json(
      {
        notifications,
        unreadCount: counts.unread,
        counts,
        page: { offset, limit, total, hasMore: offset + notifications.length < total },
      },
      { headers: { "Cache-Control": "private, no-store" } },
    );
  } catch (e) {
    console.error("[notifications] GET error:", e);
    return NextResponse.json({ error: "Failed to fetch notifications" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await getOrCreateUser(await resolveUserId(req));
    const body = await req.json();
    const type = String(body?.type || "").trim();
    const title = String(body?.title || "").trim();
    const notificationBody = String(body?.body || "").trim();
    const tmdbId = body?.tmdbId == null ? null : Number(body.tmdbId);
    const mediaType = body?.mediaType == null ? null : String(body.mediaType).trim();
    if (
      !NOTIFICATION_TYPES.has(type)
      || !title
      || title.length > 200
      || !notificationBody
      || notificationBody.length > 1_000
      || (tmdbId !== null && (!Number.isSafeInteger(tmdbId) || tmdbId <= 0))
      || (mediaType !== null && !["movie", "tv"].includes(mediaType))
    ) {
      return NextResponse.json({ error: "Invalid notification payload" }, { status: 400 });
    }
    const notification = await db.notification.create({
      data: { userId: user.id, type, title, body: notificationBody, tmdbId, mediaType },
    });
    return NextResponse.json({ notification });
  } catch (e) {
    console.error("[notifications] POST error:", e);
    return NextResponse.json({ error: "Failed to create notification" }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const user = await getOrCreateUser(await resolveUserId(req));
    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");
    const action = searchParams.get("action");
    if (action === "all") {
      await db.notification.updateMany({ where: { userId: user.id, read: false }, data: { read: true } });
      return NextResponse.json({ success: true, markedAllRead: true, counts: await notificationCounts(user.id) });
    }
    if (!id) return NextResponse.json({ error: "id or action=all required" }, { status: 400 });
    const notification = await db.notification.update({
      where: { id, userId: user.id },
      data: { read: action !== "unread" },
    });
    return NextResponse.json({ notification, counts: await notificationCounts(user.id) });
  } catch (e) {
    console.error("[notifications] PATCH error:", e);
    return NextResponse.json({ error: "Failed to update notification" }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const user = await getOrCreateUser(await resolveUserId(req));
    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");
    const action = searchParams.get("action");
    if (action === "all") {
      await db.notification.deleteMany({ where: { userId: user.id } });
      return NextResponse.json({ success: true, deletedAll: true, counts: { all: 0, unread: 0, read: 0 } });
    }
    if (!id) return NextResponse.json({ error: "id or action=all required" }, { status: 400 });
    await db.notification.deleteMany({ where: { id, userId: user.id } });
    return NextResponse.json({ success: true, counts: await notificationCounts(user.id) });
  } catch (e) {
    console.error("[notifications] DELETE error:", e);
    return NextResponse.json({ error: "Failed to delete notification" }, { status: 500 });
  }
}
