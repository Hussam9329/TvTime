import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getOrCreateUser, parseUserId } from "@/lib/user";

// PATCH /api/lists/[id] — update list
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await getOrCreateUser(parseUserId(req));
    const { id } = await params;
    const body = await req.json();
    const list = await db.customList.update({
      where: { id, userId: user.id },
      data: {
        ...(body.name !== undefined && { name: body.name }),
        ...(body.description !== undefined && { description: body.description }),
        ...(body.color !== undefined && { color: body.color }),
        ...(body.isPublic !== undefined && { isPublic: body.isPublic }),
      },
      include: { items: { orderBy: { order: "asc" } } },
    });
    return NextResponse.json({ list });
  } catch (e) {
    console.error("[lists/:id] PATCH error:", e);
    return NextResponse.json({ error: "Failed to update list" }, { status: 500 });
  }
}

// DELETE /api/lists/[id] — delete list
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await getOrCreateUser(parseUserId(req));
    const { id } = await params;
    await db.customList.delete({ where: { id, userId: user.id } });
    return NextResponse.json({ success: true });
  } catch (e) {
    console.error("[lists/:id] DELETE error:", e);
    return NextResponse.json({ error: "Failed to delete list" }, { status: 500 });
  }
}
