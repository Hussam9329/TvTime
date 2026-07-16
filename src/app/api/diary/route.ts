import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getOrCreateUser, parseUserId } from "@/lib/user";

// GET /api/diary — list all watch sessions for the user
export async function GET(req: NextRequest) {
  try {
    const user = await getOrCreateUser(parseUserId(req));
    const sessions = await db.watchSession.findMany({
      where: { userId: user.id },
      orderBy: { watchedAt: "desc" },
      take: 500,
    });
    return NextResponse.json({ sessions, count: sessions.length });
  } catch (e) {
    console.error("[diary] GET error:", e);
    return NextResponse.json({ error: "Failed to fetch diary" }, { status: 500 });
  }
} 


// POST /api/diary — add a new watch session
export async function POST(req: NextRequest) {
  try {
    const user = await getOrCreateUser(parseUserId(req));
    const body = await req.json();
    const { mediaId, mediaType, tmdbId, title, season, episode, watchedAt, duration, rewatch, rating, source, notes } = body;
    if (!mediaType || !tmdbId || !title) {
      return NextResponse.json({ error: "mediaType, tmdbId, title required" }, { status: 400 });
    }
    const session = await db.watchSession.create({
      data: {
        userId: user.id,
        mediaId: mediaId || null,
        mediaType,
        tmdbId,
        title,
        season: season || null,
        episode: episode || null,
        watchedAt: watchedAt ? new Date(watchedAt) : new Date(),
        duration: duration || null,
        rewatch: rewatch || false,
        rating: rating || null,
        source: source || null,
        notes: notes || null,
      },
    });
    return NextResponse.json({ session });
  } catch (e) {
    console.error("[diary] POST error:", e);
    return NextResponse.json({ error: "Failed to create session" }, { status: 500 });
  }
}

// PATCH /api/diary?id=xxx — update a session (e.g., change date)
export async function PATCH(req: NextRequest) {
  try {
    const user = await getOrCreateUser(parseUserId(req));
    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");
    if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });
    const body = await req.json();
    const session = await db.watchSession.update({
      where: { id, userId: user.id },
      data: {
        ...(body.watchedAt && { watchedAt: new Date(body.watchedAt) }),
        ...(body.rating !== undefined && { rating: body.rating }),
        ...(body.notes !== undefined && { notes: body.notes }),
      },
    });
    return NextResponse.json({ session });
  } catch (e) {
    console.error("[diary] PATCH error:", e);
    return NextResponse.json({ error: "Failed to update session" }, { status: 500 });
  }
}

// DELETE /api/diary?id=xxx — delete a session
export async function DELETE(req: NextRequest) {
  try {
    const user = await getOrCreateUser(parseUserId(req));
    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");
    if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });
    await db.watchSession.delete({ where: { id, userId: user.id } });
    return NextResponse.json({ success: true });
  } catch (e) {
    console.error("[diary] DELETE error:", e);
    return NextResponse.json({ error: "Failed to delete session" }, { status: 500 });
  }
}
