import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getOrCreateUser } from "@/lib/user";
import { resolveUserId } from "@/lib/auth";

export const dynamic = "force-dynamic";
const MAX_DAYS = 90;

export async function GET(req: NextRequest) {
  try {
    const user = await getOrCreateUser(await resolveUserId(req));
    const url = new URL(req.url);
    const requestedDays = Number(url.searchParams.get("days") || 30);
    const days = Number.isInteger(requestedDays) ? Math.min(Math.max(requestedDays, 7), MAX_DAYS) : 30;
    const from = new Date();
    from.setHours(0, 0, 0, 0);
    const to = new Date(from);
    to.setDate(to.getDate() + days);

    const tracked = await db.media.findMany({
      where: { userId: user.id, type: "series", isFollowing: true, tmdbId: { not: null } },
      select: { tmdbId: true, title: true, poster: true },
    });
    const ids = tracked.map((item) => item.tmdbId).filter((id): id is number => id != null);
    const metadata = ids.length ? await db.tvMetadataCache.findMany({
      where: {
        tmdbId: { in: ids },
        nextEpisodeAirDate: { not: null },
      },
      select: {
        tmdbId: true,
        nextEpisodeAirDate: true,
        nextEpisodeName: true,
        nextEpisodeSeasonNumber: true,
        nextEpisodeEpisodeNumber: true,
      },
    }) : [];
    const mediaById = new Map(tracked.map((item) => [item.tmdbId, item]));
    const items = metadata.flatMap((row) => {
      const airDate = row.nextEpisodeAirDate ? new Date(`${row.nextEpisodeAirDate}T00:00:00`) : null;
      if (!airDate || Number.isNaN(airDate.getTime()) || airDate < from || airDate >= to) return [];
      const media = mediaById.get(row.tmdbId);
      if (!media) return [];
      const season = row.nextEpisodeSeasonNumber;
      const episode = row.nextEpisodeEpisodeNumber;
      return [{
        tmdbId: row.tmdbId,
        title: media.title,
        poster: media.poster,
        airDate: row.nextEpisodeAirDate,
        episodeName: row.nextEpisodeName,
        season,
        episode,
        eventType: episode === 1 ? "Season Premiere" : "New Episode",
      }];
    }).sort((a, b) => a.airDate!.localeCompare(b.airDate!) || a.title.localeCompare(b.title));

    return NextResponse.json({
      from: from.toISOString().slice(0, 10),
      to: to.toISOString().slice(0, 10),
      days,
      items,
      trackedShows: tracked.length,
      scheduledShows: items.length,
      awaitingMetadata: Math.max(0, tracked.length - metadata.length),
    }, { headers: { "Cache-Control": "private, max-age=300" } });
  } catch (error) {
    console.error("[calendar:tracked]", error);
    return NextResponse.json({ error: "Failed to load tracked calendar" }, { status: 500 });
  }
}
