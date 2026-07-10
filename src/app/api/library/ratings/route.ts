import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getOrCreateUser, parseUserId } from "@/lib/user";
import { ensureCanonicalMedia, findCanonicalMedia } from "@/lib/media-repository";
import { mediaToLegacyLibraryItem } from "@/lib/library-compat";

export async function GET(req: NextRequest) {
  try {
    const user = await getOrCreateUser(parseUserId(req));
    const mediaType = new URL(req.url).searchParams.get("mediaType");
    const type = mediaType === "tv" ? "series" : mediaType || undefined;
    const items = await db.media.findMany({
      where: { userId: user.id, userRating: { not: null }, ...(type ? { type } : {}) },
      orderBy: { updatedAt: "desc" },
    });
    return NextResponse.json({ items: items.map(mediaToLegacyLibraryItem) });
  } catch (error) {
    console.error("[library:ratings:GET]", error);
    return NextResponse.json({ error: "Failed to load ratings" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await getOrCreateUser(parseUserId(req));
    const body = await req.json();
    const { mediaType, tmdbId, value, title, posterPath } = body;
    if (!mediaType || !tmdbId || value == null) {
      return NextResponse.json({ error: "mediaType, tmdbId, value required" }, { status: 400 });
    }

    const item = await ensureCanonicalMedia({
      userId: user.id,
      tmdbId: Number(tmdbId),
      title: title || "Unknown",
      type: mediaType,
      poster: posterPath || null,
      initialState: "none",
    });
    const updated = await db.media.update({
      where: { id: item.id },
      data: { userRating: Math.max(0, Math.min(100, Number(value) <= 10 ? Number(value) * 10 : Number(value))) },
    });
    return NextResponse.json({ item: mediaToLegacyLibraryItem(updated) });
  } catch (error) {
    console.error("[library:ratings:POST]", error);
    return NextResponse.json({ error: "Failed to save rating" }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const user = await getOrCreateUser(parseUserId(req));
    const url = new URL(req.url);
    const mediaType = url.searchParams.get("mediaType");
    const tmdbId = Number(url.searchParams.get("tmdbId"));
    if (!mediaType || !tmdbId) return NextResponse.json({ error: "mediaType, tmdbId required" }, { status: 400 });
    const item = await findCanonicalMedia(user.id, mediaType, tmdbId);
    if (item) await db.media.update({ where: { id: item.id }, data: { userRating: null } });
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("[library:ratings:DELETE]", error);
    return NextResponse.json({ error: "Failed to remove rating" }, { status: 500 });
  }
}
