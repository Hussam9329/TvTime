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
  const updated = await db.user.update({
    where: { id: user.id },
    data: {
      ...(body.name ? { name: body.name } : {}),
      ...(body.avatar !== undefined ? { avatar: body.avatar } : {}),
    },
  });
  return NextResponse.json({ user: updated });
}
