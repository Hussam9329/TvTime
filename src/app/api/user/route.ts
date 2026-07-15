import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getOrCreateUser, parseUserId } from "@/lib/user";

// GET - get or create user
export async function GET(req: NextRequest) {
  const userId = parseUserId(req);
  if (!userId) return NextResponse.json({ error: "userId required" }, { status: 400 });

  const user = await getOrCreateUser(userId);
  return NextResponse.json({ user });
}

// PATCH - update user name
export async function PATCH(req: NextRequest) {
  const userId = parseUserId(req);
  if (!userId) return NextResponse.json({ error: "userId required" }, { status: 400 });

  const body = await req.json();
  const user = await getOrCreateUser(userId);
  const name = typeof body?.name === "string" ? body.name.trim().slice(0, 30) : undefined;
  if (body?.name !== undefined && !name) {
    return NextResponse.json({ error: "Display name cannot be empty" }, { status: 400 });
  }
  const updated = await db.user.update({
    where: { id: user.id },
    data: {
      ...(name ? { name } : {}),
      ...(body.avatar !== undefined ? { avatar: body.avatar } : {}),
    },
  });
  return NextResponse.json({ user: updated });
}
