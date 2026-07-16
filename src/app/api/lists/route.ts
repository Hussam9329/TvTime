import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getOrCreateUser, parseUserId } from "@/lib/user";

function makeSlug(name: string): string {
  return name.trim().toLowerCase()
    .replace(/[^\w\u0600-\u06FF]+/g, "-")
    .replace(/^-+|-+$/g, "") + "-" + Date.now().toString(36);
}

// GET /api/lists — list user's custom lists
export async function GET(req: NextRequest) {
  try {
    const user = await getOrCreateUser(parseUserId(req));
    const lists = await db.customList.findMany({
      where: { userId: user.id },
      include: { items: { orderBy: { order: "asc" } } },
      orderBy: { createdAt: "desc" },
    });
    return NextResponse.json({ lists, count: lists.length });
  } catch (e) {
    console.error("[lists] GET error:", e);
    return NextResponse.json({ error: "Failed to fetch lists" }, { status: 500 });
  }
}

// POST /api/lists — create a new list
export async function POST(req: NextRequest) {
  try {
    const user = await getOrCreateUser(parseUserId(req));
    const body = await req.json();
    const { name, description, color, isPublic } = body;
    if (!name || !name.trim()) {
      return NextResponse.json({ error: "name required" }, { status: 400 });
    }
    const list = await db.customList.create({
      data: {
        userId: user.id,
        name: name.trim(),
        description: description?.trim() || null,
        color: color || "#f59e0b",
        isPublic: !!isPublic,
        slug: makeSlug(name),
      },
      include: { items: true },
    });
    return NextResponse.json({ list });
  } catch (e) {
    console.error("[lists] POST error:", e);
    return NextResponse.json({ error: "Failed to create list" }, { status: 500 });
  }
}
