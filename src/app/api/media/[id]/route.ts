import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getOrCreateUser, parseUserId } from "@/lib/user";
import { normalizeMedia } from "@/lib/media-normalize";

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const user = await getOrCreateUser(parseUserId(req));
    const body = await req.json();

    const data: any = {};
    if (body.userRating !== undefined) data.userRating = body.userRating === null ? null : Math.max(0, Math.min(100, Number(body.userRating)));
    if (body.watched !== undefined) data.watched = Boolean(body.watched);
    if (body.watchedAt !== undefined) data.watchedAt = body.watchedAt ? new Date(body.watchedAt) : null;
    if (body.isAnime !== undefined) data.isAnime = Boolean(body.isAnime);
    if (body.status !== undefined) data.status = body.status;
    if (body.ratingStatus !== undefined) data.ratingStatus = body.ratingStatus;
    if (body.notes !== undefined) data.notes = body.notes || null;
    if (body.rewatch !== undefined) data.rewatch = Boolean(body.rewatch);

    const existing = await db.media.findFirst({ where: { id, userId: user.id } });
    if (!existing) return NextResponse.json({ error: "Media item not found" }, { status: 404 });

    const item = await db.media.update({ where: { id }, data });
    return NextResponse.json({ item: normalizeMedia(item) });
  } catch (error) {
    console.error("[media:update]", error);
    return NextResponse.json({ error: "Failed to update media item" }, { status: 500 });
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const user = await getOrCreateUser(parseUserId(req));
    const result = await db.media.deleteMany({ where: { id, userId: user.id } });
    if (result.count === 0) return NextResponse.json({ error: "Media item not found" }, { status: 404 });
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("[media:delete]", error);
    return NextResponse.json({ error: "Failed to delete media item" }, { status: 500 });
  }
}
