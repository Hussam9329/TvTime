import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getOrCreateUser, parseUserId } from "@/lib/user";

function csv(value: unknown) { const text = value == null ? "" : Array.isArray(value) ? value.join("|") : String(value); return `"${text.replaceAll('"', '""')}"`; }

export async function GET(req: NextRequest) {
  try {
    const user = await getOrCreateUser(parseUserId(req));
    const [media, episodes] = await Promise.all([
      db.media.findMany({ where: { userId: user.id }, orderBy: { addedAt: "asc" } }),
      db.watchedEpisode.findMany({ where: { userId: user.id }, orderBy: [{ showId: "asc" }, { seasonNumber: "asc" }, { episodeNumber: "asc" }] }),
    ]);
    const header = ["recordType", "tmdbId", "mediaType", "title", "year", "status", "watched", "watchedAt", "rating", "rewatchCount", "season", "episode", "episodeName", "runtime", "poster", "genres"];
    const rows = [header.map(csv).join(",")];
    for (const item of media) rows.push(["media", item.tmdbId, item.type, item.title, item.year, item.status, item.watched, item.watchedAt?.toISOString(), item.userRating, item.rewatchCount, "", "", "", item.runtime, item.poster, item.genres].map(csv).join(","));
    for (const item of episodes) rows.push(["episode", item.showId, "series", "", "", "watched", true, item.watchedAt.toISOString(), "", "", item.seasonNumber, item.episodeNumber, item.episodeName, item.runtime, "", ""].map(csv).join(","));
    return new NextResponse(`\uFEFF${rows.join("\r\n")}`, { headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": `attachment; filename="tvtime-library-${new Date().toISOString().slice(0, 10)}.csv"`, "Cache-Control": "private, no-store" } });
  } catch (error) {
    console.error("[library:export:csv]", error);
    return NextResponse.json({ error: "Failed to export CSV" }, { status: 500 });
  }
}
