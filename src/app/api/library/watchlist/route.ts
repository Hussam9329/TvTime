import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getOrCreateUser, parseUserId } from "@/lib/user";
import { ensureCanonicalMedia, findCanonicalMedia, updateCanonicalMediaState } from "@/lib/media-repository";
import { mediaToLegacyLibraryItem } from "@/lib/library-compat";

export async function GET(req: NextRequest) {
  try {
    const user = await getOrCreateUser(parseUserId(req));
    const url = new URL(req.url);
    const mediaType = url.searchParams.get("mediaType");
    const type = mediaType === "tv" ? "series" : mediaType || undefined;
    const items = await db.media.findMany({
      where: { userId: user.id, libraryState: "planned", ...(type ? { type } : {}) },
      orderBy: { stateChangedAt: "desc" },
    });
    return NextResponse.json({ items: items.map(mediaToLegacyLibraryItem) });
  } catch (error) {
    console.error("[library:watchlist:GET]", error);
    return NextResponse.json({ error: "Failed to load watchlist" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await getOrCreateUser(parseUserId(req));
    const body = await req.json();
    const { mediaType, tmdbId, title, posterPath, overview, releaseDate, voteAverage } = body;
    if (!mediaType || !tmdbId || !title) {
      return NextResponse.json({ error: "mediaType, tmdbId, title required" }, { status: 400 });
    }
    const item = await ensureCanonicalMedia({
      userId: user.id,
      type: mediaType,
      tmdbId: Number(tmdbId),
      title,
      poster: posterPath || null,
      overview: overview || null,
      year: releaseDate ? String(releaseDate).slice(0, 4) : null,
      rating: voteAverage,
      initialState: "planned",
    });
    return NextResponse.json({ item: mediaToLegacyLibraryItem(item) });
  } catch (error) {
    console.error("[library:watchlist:POST]", error);
    return NextResponse.json({ error: "Failed to add watchlist item" }, { status: 500 });
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
    if (item?.libraryState === "planned") await updateCanonicalMediaState(item, "none");
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("[library:watchlist:DELETE]", error);
    return NextResponse.json({ error: "Failed to remove watchlist item" }, { status: 500 });
  }
}
