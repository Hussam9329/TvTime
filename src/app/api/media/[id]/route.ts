import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

// PATCH - update a media item (set rating, watched, isAnime, etc.)
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const body = await req.json();

  const data: any = {};
  if (body.userRating !== undefined) {
    data.userRating = body.userRating === null ? null : Math.max(0, Math.min(100, Number(body.userRating)));
  }
  if (body.watched !== undefined) data.watched = Boolean(body.watched);
  if (body.watchedAt !== undefined) data.watchedAt = body.watchedAt ? new Date(body.watchedAt) : null;
  if (body.isAnime !== undefined) data.isAnime = Boolean(body.isAnime);
  if (body.status !== undefined) data.status = body.status;
  if (body.ratingStatus !== undefined) data.ratingStatus = body.ratingStatus;

  const item = await db.media.update({
    where: { id },
    data,
  });

  return NextResponse.json({ item });
}

// DELETE - remove a media item
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  await db.media.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
