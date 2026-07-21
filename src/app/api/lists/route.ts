import { randomUUID } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getOrCreateUser } from "@/lib/user";
import { resolveUserId } from "@/lib/auth";
import { createCustomListSchema } from "@/lib/custom-list-contract";

function makeSlug(name: string): string {
  const stem = name.trim().toLowerCase()
    .replace(/[^\w\u0600-\u06FF]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60) || "list";
  return `${stem}-${randomUUID().slice(0, 10)}`;
}

// GET /api/lists — list the signed-in user's custom lists.
export async function GET(req: NextRequest) {
  try {
    const user = await getOrCreateUser(await resolveUserId(req));
    const lists = await db.customList.findMany({
      where: { userId: user.id },
      include: { items: { orderBy: [{ order: "asc" }, { addedAt: "asc" }] } },
      orderBy: { createdAt: "desc" },
    });
    return NextResponse.json({ lists, count: lists.length }, {
      headers: { "Cache-Control": "private, no-store" },
    });
  } catch (error) {
    console.error("[lists] GET error:", error);
    return NextResponse.json({ error: "Failed to fetch lists" }, { status: 500 });
  }
}

// POST /api/lists — create a new list.
export async function POST(req: NextRequest) {
  try {
    const user = await getOrCreateUser(await resolveUserId(req));
    const parsed = createCustomListSchema.safeParse(await req.json().catch(() => null));
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid list details", issues: parsed.error.flatten() }, { status: 400 });
    }

    const list = await db.customList.create({
      data: {
        userId: user.id,
        ...parsed.data,
        slug: makeSlug(parsed.data.name),
      },
      include: { items: true },
    });
    return NextResponse.json({ list }, { status: 201 });
  } catch (error) {
    console.error("[lists] POST error:", error);
    return NextResponse.json({ error: "Failed to create list" }, { status: 500 });
  }
}
