import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { getOrCreateUser } from "@/lib/user";
import { resolveUserId } from "@/lib/auth";

function validTimezone(value: string): boolean {
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: value }).format(new Date());
    return true;
  } catch {
    return false;
  }
}

const updateUserSchema = z.object({
  name: z.string().trim().min(1).max(30).optional(),
  avatar: z.string().trim().max(2_000).nullable().optional(),
  timezone: z.string().trim().min(1).max(100).refine(validTimezone, "Invalid IANA timezone").optional(),
  country: z.string().trim().toUpperCase().regex(/^[A-Z]{2}$/).optional(),
  preferredPlatforms: z.array(z.string().trim().min(1).max(100)).max(100).transform((items) => [...new Set(items)]).optional(),
}).strict();

export async function GET(req: NextRequest) {
  try {
    const user = await getOrCreateUser(await resolveUserId(req));
    return NextResponse.json({ user }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    console.error("[user] GET", error);
    return NextResponse.json({ error: "Failed to load profile" }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const parsed = updateUserSchema.safeParse(await req.json().catch(() => null));
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid profile update", issues: parsed.error.flatten() }, { status: 400 });
    }
    const user = await getOrCreateUser(await resolveUserId(req));
    const updated = await db.user.update({ where: { id: user.id }, data: parsed.data });
    return NextResponse.json({ user: updated });
  } catch (error) {
    console.error("[user] PATCH", error);
    return NextResponse.json({ error: "Failed to update profile" }, { status: 500 });
  }
}
