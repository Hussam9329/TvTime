import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getOrCreateUser, parseUserId } from "@/lib/user";
import { ensureCanonicalMedia, findCanonicalMedia, updateCanonicalMediaState } from "@/lib/media-repository";
import { mediaToLegacyLibraryItem } from "@/lib/library-compat";

export async function GET(req: NextRequest) {
  try {
    const user = await getOrCreateUser(parseUserId(req));
    const items = await db.media.findMany({
      where: { userId: user.id, type: "movie", libraryState: "completed" },
      orderBy: [{ watchedAt: "desc" }, { stateChangedAt: "desc" }],
    });
    return NextResponse.json({ items: items.map(mediaToLegacyLibraryItem) });
  } catch (error) {
    console.error("[library:watched-movies:GET]", error);
    return NextResponse.json({ error: "Failed to load watched movies" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await getOrCreateUser(parseUserId(req));
    const body = await req.json();
    const { tmdbId, title, posterPath, runtime } = body;
    if (!tmdbId || !title) return NextResponse.json({ error: "tmdbId, title required" }, { status: 400 });

    const item = await ensureCanonicalMedia({
      userId: user.id,
      tmdbId: Number(tmdbId),
      title,
      type: "movie",
      poster: posterPath || null,
      runtime: runtime == null ? null : Number(runtime),
      initialState: "completed",
    });
    const completed = await updateCanonicalMediaState(item, "completed", { completedAt: new Date() });
    return NextResponse.json({ item: mediaToLegacyLibraryItem(completed) });
  } catch (error) {
    console.error("[library:watched-movies:POST]", error);
    return NextResponse.json({ error: "Failed to mark movie watched" }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const user = await getOrCreateUser(parseUserId(req));
    const tmdbId = Number(new URL(req.url).searchParams.get("tmdbId"));
    if (!tmdbId) return NextResponse.json({ error: "tmdbId required" }, { status: 400 });
    const item = await findCanonicalMedia(user.id, "movie", tmdbId);
    if (item?.libraryState === "completed") await updateCanonicalMediaState(item, "planned");
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("[library:watched-movies:DELETE]", error);
    return NextResponse.json({ error: "Failed to unmark movie" }, { status: 500 });
  }
}
