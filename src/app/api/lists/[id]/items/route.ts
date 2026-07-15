import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getOrCreateUser, parseUserId } from "@/lib/user";

// POST /api/lists/[id]/items — add item to list
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await getOrCreateUser(parseUserId(req));
    const { id } = await params;
    // Ensure list belongs to user
    const list = await db.customList.findFirst({ where: { id, userId: user.id } });
    if (!list) return NextResponse.json({ error: "List not found" }, { status: 404 });
    const body = await req.json();
    const { tmdbId, mediaType, title, posterPath } = body;
    if (!tmdbId || !mediaType || !title) {
      return NextResponse.json({ error: "tmdbId, mediaType, title required" }, { status: 400 });
    }
    // Check existing count for order
    const existingCount = await db.customListItem.count({ where: { listId: id } });
    const item = await db.customListItem.upsert({
      where: { listId_tmdbId_mediaType: { listId: id, tmdbId, mediaType } },
      create: {
        listId: id, tmdbId, mediaType, title, posterPath: posterPath || null,
        order: existingCount,
      },
      update: { title, posterPath: posterPath || null },
    });
    return NextResponse.json({ item });
  } catch (e) {
    console.error("[lists/:id/items] POST error:", e);
    return NextResponse.json({ error: "Failed to add item" }, { status: 500 });
  }
}

// DELETE /api/lists/[id]/items?tmdbId=xxx&mediaType=xxx — remove item from list
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await getOrCreateUser(parseUserId(req));
    const { id } = await params;
    const list = await db.customList.findFirst({ where: { id, userId: user.id } });
    if (!list) return NextResponse.json({ error: "List not found" }, { status: 404 });
    const { searchParams } = new URL(req.url);
    const tmdbId = Number(searchParams.get("tmdbId"));
    const mediaType = searchParams.get("mediaType");
    if (!tmdbId || !mediaType) {
      return NextResponse.json({ error: "tmdbId, mediaType required" }, { status: 400 });
    }
    await db.customListItem.delete({
      where: { listId_tmdbId_mediaType: { listId: id, tmdbId, mediaType } },
    });
    return NextResponse.json({ success: true });
  } catch (e) {
    console.error("[lists/:id/items] DELETE error:", e);
    return NextResponse.json({ error: "Failed to remove item" }, { status: 500 });
  }
}
