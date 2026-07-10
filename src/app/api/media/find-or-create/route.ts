import { NextRequest, NextResponse } from "next/server";
import { getOrCreateUser, parseUserId } from "@/lib/user";
import { normalizeMedia } from "@/lib/media-normalize";
import { ensureCanonicalMedia } from "@/lib/media-repository";
import { normalizeCanonicalState } from "@/lib/media-state";

export async function POST(req: NextRequest) {
  try {
    const user = await getOrCreateUser(parseUserId(req));
    const body = await req.json();
    const {
      tmdbId,
      title,
      type,
      poster,
      year,
      overview,
      rating,
      runtime,
      genres,
      seasons,
      episodes,
      isAnime,
      initialState,
    } = body;

    if (!title || typeof title !== "string") {
      return NextResponse.json({ error: "title required" }, { status: 400 });
    }

    const item = await ensureCanonicalMedia({
      userId: user.id,
      tmdbId: tmdbId ? Number(tmdbId) : null,
      title,
      type: type === "tv" ? "series" : type || "movie",
      poster: poster || null,
      year: year || null,
      overview: overview || null,
      rating,
      runtime: runtime != null ? Number(runtime) : null,
      genres,
      seasons: seasons != null ? Number(seasons) : null,
      episodes: episodes != null ? Number(episodes) : null,
      isAnime,
      // Existing clients historically expected find-or-create to add to the
      // library. New callers can explicitly pass `none` for rating-only rows.
      initialState: normalizeCanonicalState(initialState) ?? "planned",
    });

    return NextResponse.json({ item: normalizeMedia(item) });
  } catch (error) {
    console.error("[media:find-or-create]", error);
    return NextResponse.json({ error: "Failed to save media item" }, { status: 500 });
  }
}
