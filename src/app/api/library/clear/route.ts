import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getOrCreateUser, parseUserId } from "@/lib/user";

// DELETE - clear all library data for the user (Media + WatchedEpisode + legacy tables).
// The user record itself is preserved.
export async function DELETE(req: NextRequest) {
  const userId = parseUserId(req);
  if (!userId) return NextResponse.json({ error: "userId required" }, { status: 400 });

  const user = await getOrCreateUser(userId);

  await Promise.all([
    db.media.deleteMany({ where: { userId: user.id } }),
    db.watchedEpisode.deleteMany({ where: { userId: user.id } }),
    // Legacy tables (in case any data remains from the old schema)
    db.watchlistItem.deleteMany({ where: { userId: user.id } }),
    db.watchedMovie.deleteMany({ where: { userId: user.id } }),
    db.followingShow.deleteMany({ where: { userId: user.id } }),
    db.rating.deleteMany({ where: { userId: user.id } }),
  ]);

  return NextResponse.json({ ok: true });
}
