import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getOrCreateUser } from "@/lib/user";
import { resolveUserId } from "@/lib/auth";
import { customListItemSchema, listMediaTypeSchema } from "@/lib/custom-list-contract";

type RouteContext = { params: Promise<{ id: string }> };

async function ownedList(id: string, userId: string) {
  return db.customList.findFirst({ where: { id, userId }, select: { id: true } });
}

// POST /api/lists/[id]/items — add or refresh one list item.
export async function POST(req: NextRequest, { params }: RouteContext) {
  try {
    const user = await getOrCreateUser(await resolveUserId(req));
    const { id } = await params;
    if (!await ownedList(id, user.id)) return NextResponse.json({ error: "List not found" }, { status: 404 });

    const parsed = customListItemSchema.safeParse(await req.json().catch(() => null));
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid list item", issues: parsed.error.flatten() }, { status: 400 });
    }

    const existing = await db.customListItem.findUnique({
      where: { listId_tmdbId_mediaType: { listId: id, tmdbId: parsed.data.tmdbId, mediaType: parsed.data.mediaType } },
      select: { id: true },
    });
    const nextOrder = existing ? 0 : await db.customListItem.count({ where: { listId: id } });
    const item = await db.customListItem.upsert({
      where: { listId_tmdbId_mediaType: { listId: id, tmdbId: parsed.data.tmdbId, mediaType: parsed.data.mediaType } },
      create: { listId: id, ...parsed.data, order: nextOrder },
      update: { title: parsed.data.title, posterPath: parsed.data.posterPath },
    });
    return NextResponse.json({ item, duplicate: Boolean(existing) }, { status: existing ? 200 : 201 });
  } catch (error) {
    console.error("[lists/:id/items] POST error:", error);
    return NextResponse.json({ error: "Failed to add item" }, { status: 500 });
  }
}

// DELETE /api/lists/[id]/items?tmdbId=...&mediaType=... — remove an item.
export async function DELETE(req: NextRequest, { params }: RouteContext) {
  try {
    const user = await getOrCreateUser(await resolveUserId(req));
    const { id } = await params;
    if (!await ownedList(id, user.id)) return NextResponse.json({ error: "List not found" }, { status: 404 });

    const tmdbId = Number(req.nextUrl.searchParams.get("tmdbId"));
    const mediaType = listMediaTypeSchema.safeParse(req.nextUrl.searchParams.get("mediaType"));
    if (!Number.isInteger(tmdbId) || tmdbId <= 0 || !mediaType.success) {
      return NextResponse.json({ error: "Valid tmdbId and mediaType are required" }, { status: 400 });
    }

    const deleted = await db.customListItem.deleteMany({
      where: { listId: id, tmdbId, mediaType: mediaType.data },
    });
    if (deleted.count === 0) return NextResponse.json({ error: "List item not found" }, { status: 404 });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[lists/:id/items] DELETE error:", error);
    return NextResponse.json({ error: "Failed to remove item" }, { status: 500 });
  }
}
