import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getOrCreateUser } from "@/lib/user";
import { resolveUserId } from "@/lib/auth";
import { updateCustomListSchema } from "@/lib/custom-list-contract";

type RouteContext = { params: Promise<{ id: string }> };

// PATCH /api/lists/[id] — update an owned list.
export async function PATCH(req: NextRequest, { params }: RouteContext) {
  try {
    const user = await getOrCreateUser(await resolveUserId(req));
    const { id } = await params;
    const parsed = updateCustomListSchema.safeParse(await req.json().catch(() => null));
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid list details", issues: parsed.error.flatten() }, { status: 400 });
    }

    const owned = await db.customList.findFirst({ where: { id, userId: user.id }, select: { id: true } });
    if (!owned) return NextResponse.json({ error: "List not found" }, { status: 404 });

    const list = await db.customList.update({
      where: { id },
      data: parsed.data,
      include: { items: { orderBy: [{ order: "asc" }, { addedAt: "asc" }] } },
    });
    return NextResponse.json({ list });
  } catch (error) {
    console.error("[lists/:id] PATCH error:", error);
    return NextResponse.json({ error: "Failed to update list" }, { status: 500 });
  }
}

// DELETE /api/lists/[id] — delete an owned list.
export async function DELETE(req: NextRequest, { params }: RouteContext) {
  try {
    const user = await getOrCreateUser(await resolveUserId(req));
    const { id } = await params;
    const deleted = await db.customList.deleteMany({ where: { id, userId: user.id } });
    if (deleted.count === 0) return NextResponse.json({ error: "List not found" }, { status: 404 });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[lists/:id] DELETE error:", error);
    return NextResponse.json({ error: "Failed to delete list" }, { status: 500 });
  }
}
