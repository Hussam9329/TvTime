import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getOrCreateUser, parseUserId } from "@/lib/user";

function episodeParts(key: string) {
  const [season, episode] = key.split("-").map(Number);
  return Number.isInteger(season) && Number.isInteger(episode) ? { season, episode } : null;
}

function posterUrl(value: string | null | undefined) {
  if (!value) return null;
  if (value.startsWith("http://") || value.startsWith("https://")) return value;
  return value.startsWith("/") ? `https://image.tmdb.org/t/p/w342${value}` : null;
}

export async function GET(req: NextRequest) {
  try {
    const user = await getOrCreateUser(parseUserId(req));
    const shows = await db.media.findMany({
      where: { userId: user.id, type: "series", isFollowing: true, tmdbId: { not: null } },
      select: { tmdbId: true, title: true, poster: true, watchedAt: true, updatedAt: true, watched: true, status: true, userRating: true, isAnime: true, isArabic: true },
    });
    const ids = shows.map((show) => show.tmdbId!).filter(Boolean);
    if (ids.length === 0) return NextResponse.json({ items: [] });
    const [metadata, watched] = await Promise.all([
      db.tvMetadataCache.findMany({
        where: { tmdbId: { in: ids } },
        select: {
          tmdbId: true,
          posterPath: true,
          officiallyEnded: true,
          airedEpisodeKeys: true,
          nextEpisodeAirDate: true,
          nextEpisodeName: true,
          nextEpisodeSeasonNumber: true,
          nextEpisodeEpisodeNumber: true,
        },
      }),
      db.watchedEpisode.findMany({ where: { userId: user.id, showId: { in: ids } }, select: { showId: true, seasonNumber: true, episodeNumber: true } }),
    ]);
    const watchedByShow = new Map<number, Set<string>>();
    for (const row of watched) {
      const set = watchedByShow.get(row.showId) ?? new Set<string>();
      set.add(`${row.seasonNumber}-${row.episodeNumber}`);
      watchedByShow.set(row.showId, set);
    }
    const metadataById = new Map(metadata.map((row) => [row.tmdbId, row]));
    const items = shows.flatMap((show) => {
      const meta = metadataById.get(show.tmdbId!);
      if (show.status === "finished" || (meta?.officiallyEnded === true && show.userRating != null) || (show.watched && show.status !== "watching")) return [];
      const seen = watchedByShow.get(show.tmdbId!) ?? new Set<string>();
      const next = (meta?.airedEpisodeKeys ?? []).map(episodeParts).filter((value): value is { season: number; episode: number } => Boolean(value))
        .sort((a, b) => a.season - b.season || a.episode - b.episode)
        .find((episode) => !seen.has(`${episode.season}-${episode.episode}`));
      const poster = posterUrl(show.poster) || posterUrl(meta?.posterPath);
      return next ? [{ tmdbId: show.tmdbId!, title: show.title, poster, seasonNumber: next.season, episodeNumber: next.episode, watchedEpisodes: seen.size, releasedEpisodes: meta?.airedEpisodeKeys.length ?? 0, lastActivity: show.watchedAt || show.updatedAt, isAnime: show.isAnime, isArabic: show.isArabic }] : [];
    }).sort((a, b) => b.lastActivity.getTime() - a.lastActivity.getTime());
    const today = new Date().toISOString().slice(0, 10);
    const upcoming = shows.flatMap((show) => {
      const meta = metadataById.get(show.tmdbId!);
      if (
        show.status === "finished"
        || !meta?.nextEpisodeAirDate
        || meta.nextEpisodeAirDate <= today
        || meta.nextEpisodeSeasonNumber == null
        || meta.nextEpisodeEpisodeNumber == null
      ) return [];
      return [{
        tmdbId: show.tmdbId!,
        title: show.title,
        poster: posterUrl(show.poster) || posterUrl(meta.posterPath),
        seasonNumber: meta.nextEpisodeSeasonNumber,
        episodeNumber: meta.nextEpisodeEpisodeNumber,
        episodeName: meta.nextEpisodeName,
        airDate: meta.nextEpisodeAirDate,
        isAnime: show.isAnime,
        isArabic: show.isArabic,
      }];
    }).sort((a, b) => a.airDate.localeCompare(b.airDate));
    return NextResponse.json({ items: items.slice(0, 20), upcoming });
  } catch (error) {
    console.error("[watch-next]", error);
    return NextResponse.json({ error: "Failed to build Watch Next" }, { status: 500 });
  }
}
