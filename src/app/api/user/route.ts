import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getOrCreateUser, parseUserId } from "@/lib/user";
import { validateBody } from "@/lib/validate";
import { handleError } from "@/lib/api-error";
import { updateUserSchema } from "@/lib/schemas/media";

// GET - get or create user
export async function GET(req: NextRequest) {
  try {
    const userId = parseUserId(req);
    if (!userId) {
      return NextResponse.json({ error: "userId required" }, { status: 400 });
    }
    const user = await getOrCreateUser(userId);
    return NextResponse.json({ user });
  } catch (error) {
    return handleError(error);
  }
}

// PATCH - update user name
export async function PATCH(req: NextRequest) {
  try {
    const userId = parseUserId(req);
    if (!userId) {
      return NextResponse.json({ error: "userId required" }, { status: 400 });
    }

    const body = await req.json();
    const result = validateBody(updateUserSchema, body);
    if (result instanceof NextResponse) return result;

    const user = await getOrCreateUser(userId);
    const name = result.name;
    if (body?.name !== undefined && !name) {
      return NextResponse.json({ error: "Display name cannot be empty" }, { status: 400 });
    }
    const updated = await db.user.update({
      where: { id: user.id },
      data: {
        ...(name ? { name } : {}),
        ...(result.avatar !== undefined ? { avatar: result.avatar } : {}),
      },
    });
    return NextResponse.json({ user: updated });
  } catch (error) {
    return handleError(error);
  }
}
