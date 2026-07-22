import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getOrCreateUser, parseUserId } from "@/lib/user";
import { canonicalMediaPoster } from "@/lib/media-poster";

export async function POST(req: NextRequest) {
  try {
    const user = await getOrCreateUser(parseUserId(req));
    const body = await req.json();
    const tmdbId = Number(body.tmdbId);
    const type = body.mediaType === "tv" ? "series" : body.mediaType === "movie" ? "movie" : null;
    const path = body.posterPath === null ? null : String(body.posterPath || "");
    if (!Number.isInteger(tmdbId) || tmdbId <= 0 || !type || !String(body.title || "").trim()) {
      return NextResponse.json({ error: "Valid media identity is required" }, { status: 400 });
    }
    if (path !== null && !/^\/[A-Za-z0-9._/-]+\.(jpg|jpeg|png|webp)$/i.test(path)) {
      return NextResponse.json({ error: "Only official TMDB poster paths are accepted" }, { status: 400 });
    }
    const poster = path ? canonicalMediaPoster(path) : null;
    const existing = await db.media.findUnique({ where: { userId_type_tmdbId: { userId: user.id, type, tmdbId } }, select: { tags: true } });
    const tags = [...(existing?.tags ?? []).filter((tag) => !tag.startsWith("custom-poster:")), ...(path ? [`custom-poster:${path}`] : [])];
    const item = await db.media.upsert({
      where: { userId_type_tmdbId: { userId: user.id, type, tmdbId } },
      create: { userId: user.id, type, tmdbId, title: String(body.title).trim(), poster, tags },
      update: { poster, tags },
    });
    return NextResponse.json({ item });
  } catch (error) {
    console.error("[media:poster]", error);
    return NextResponse.json({ error: "Failed to save poster" }, { status: 500 });
  }
}
