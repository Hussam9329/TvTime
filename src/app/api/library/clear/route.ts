import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getOrCreateUser, parseUserId } from "@/lib/user";

// DELETE - clear all library data for the user (but keep the user record)
export async function DELETE(req: NextRequest) {
  const userId = parseUserId(req);
  if (!userId) return NextResponse.json({ error: "userId required" }, { status: 400 });

  const user = await getOrCreateUser(userId);

  await Promise.all([
    db.watchlistItem.deleteMany({ where: { userId: user.id } }),
    db.watchedMovie.deleteMany({ where: { userId: user.id } }),
    db.watchedEpisode.deleteMany({ where: { userId: user.id } }),
    db.followingShow.deleteMany({ where: { userId: user.id } }),
    db.rating.deleteMany({ where: { userId: user.id } }),
  ]);

  return NextResponse.json({ ok: true });
}
