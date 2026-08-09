import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { resolveUserId } from "@/lib/auth";
import { getOrCreateUser } from "@/lib/user";
import { classifyMediaWorld } from "@/lib/media-world-classification";
import { resolveGeneralMediaClassifications } from "@/lib/media-classification-resolver-server";
import { matchesDiscoverWorld } from "@/lib/discover-world";
import { tmdb, type MediaItem } from "@/lib/tmdb";

const ANIMATION_GENRE = 16;

type AnimeHubItem = MediaItem & { media_type: "movie" | "tv" };

function dateOnly(date: Date) {
  return date.toISOString().slice(0, 10);
}

function mediaTypeOf(item: MediaItem): "movie" | "tv" {
  return item.media_type === "movie" || item.title ? "movie" : "tv";
}

function animeOnly(items: MediaItem[], mediaType: "movie" | "tv") {
  return items
    .filter((item) => item.poster_path && matchesDiscoverWorld(item, mediaType, "anime"))
    .map((item) => ({ ...item, media_type: mediaType } as AnimeHubItem));
}

function dedupe(items: AnimeHubItem[], limit = 20) {
  const seen = new Set<string>();
  const result: AnimeHubItem[] = [];
  for (const item of items) {
    const mediaType = mediaTypeOf(item);
    const key = `${mediaType}:${item.id}`;
    if (!item.id || seen.has(key) || !item.poster_path) continue;
    seen.add(key);
    result.push({ ...item, media_type: mediaType });
    if (result.length >= limit) break;
  }
  return result;
}

function sortByPopularity(items: AnimeHubItem[]) {
  return [...items].sort((left, right) => Number(right.popularity || 0) - Number(left.popularity || 0));
}

function itemFromRecord(item: {
  tmdbId: number | null;
  type: string;
  title: string;
  originalTitle: string | null;
  poster: string | null;
  overview: string | null;
  year: string | null;
  rating: string | null;
  originalLanguage: string | null;
  originCountries: string[];
}, englishTitle?: string | null): AnimeHubItem | null {
  if (!item.tmdbId || !item.poster || (item.type !== "movie" && item.type !== "series")) return null;
  const mediaType = item.type === "series" ? "tv" : "movie";
  const displayTitle = englishTitle?.trim() || item.title;
  return {
    id: item.tmdbId,
    ...(mediaType === "movie" ? { title: displayTitle } : { name: displayTitle }),
    ...(mediaType === "movie"
      ? { original_title: item.originalTitle || undefined, release_date: item.year ? `${item.year.slice(0, 4)}-01-01` : undefined }
      : { original_name: item.originalTitle || undefined, first_air_date: item.year ? `${item.year.slice(0, 4)}-01-01` : undefined }),
    poster_path: item.poster,
    backdrop_path: null,
    overview: item.overview || "",
    vote_average: Number(item.rating || 0),
    vote_count: 0,
    popularity: 0,
    media_type: mediaType,
    original_language: item.originalLanguage || undefined,
    origin_country: item.originCountries,
    genre_ids: [ANIMATION_GENRE],
  };
}

export async function GET(req: NextRequest) {
  try {
    const user = await getOrCreateUser(await resolveUserId(req));
    const now = new Date();
    const today = dateOnly(now);
    const oneYearAgo = new Date(now);
    oneYearAgo.setFullYear(now.getFullYear() - 1);
    const sixMonthsAhead = new Date(now);
    sixMonthsAhead.setMonth(now.getMonth() + 6);
    const seasonStartMonth = Math.floor(now.getMonth() / 3) * 3;
    const seasonStart = new Date(now.getFullYear(), seasonStartMonth, 1, 12);
    const seasonEnd = new Date(now.getFullYear(), seasonStartMonth + 3, 0, 12);

    const stored = await db.media.findMany({
      where: { userId: user.id },
      orderBy: { updatedAt: "desc" },
    });
    const classified = await resolveGeneralMediaClassifications(stored, { allowNetwork: false });
    const animeRecords = classified.filter((item) => classifyMediaWorld(item).collectionWorld === "anime");
    const animeSeriesIds = animeRecords
      .filter((item) => item.type === "series" && item.tmdbId != null)
      .map((item) => Number(item.tmdbId));
    const episodeProgress = animeSeriesIds.length > 0
      ? await db.watchedEpisode.groupBy({
          by: ["showId"],
          where: { userId: user.id, showId: { in: animeSeriesIds } },
          _count: { _all: true },
          _max: { watchedAt: true },
        })
      : [];
    const animeMetadata = animeSeriesIds.length > 0
      ? await db.tvMetadataCache.findMany({
          where: { tmdbId: { in: animeSeriesIds } },
          select: {
            tmdbId: true,
            title: true,
            nextEpisodeAirDate: true,
            nextEpisodeName: true,
            nextEpisodeSeasonNumber: true,
            nextEpisodeEpisodeNumber: true,
          },
        })
      : [];
    const englishTitleByTmdbId = new Map(animeMetadata.map((metadata) => [metadata.tmdbId, metadata.title]));
    const itemFromAnimeRecord = (item: Parameters<typeof itemFromRecord>[0]) =>
      itemFromRecord(item, item.tmdbId ? englishTitleByTmdbId.get(Number(item.tmdbId)) : null);
    const progressByShow = new Map(episodeProgress.map((row) => [row.showId, {
      count: row._count._all,
      lastWatchedAt: row._max.watchedAt,
    }]));

    const watchlistRecords = animeRecords.filter((item) => item.status === "planned" && !item.watched);
    const inProgressRecords = animeRecords.filter((item) =>
      item.type === "series"
      && !item.watched
      && item.status !== "uptodate"
      && item.status !== "finished"
      && item.status !== "stopped"
      && (item.status === "watching" || (progressByShow.get(Number(item.tmdbId))?.count ?? 0) > 0),
    );
    const watchedRecords = animeRecords.filter((item) => item.watched || item.status === "finished");
    const animeRecordByTmdbId = new Map(animeRecords
      .filter((item) => item.type === "series" && item.tmdbId != null)
      .map((item) => [Number(item.tmdbId), item] as const));
    const nextEpisodes = animeMetadata
      .map((metadata) => ({ metadata, record: animeRecordByTmdbId.get(metadata.tmdbId) }))
      .filter((entry) => {
        if (!entry.record || !entry.metadata.nextEpisodeAirDate) return false;
        if (entry.record.status === "finished" || entry.record.status === "stopped") return false;
        return entry.metadata.nextEpisodeAirDate >= today;
      })
      .sort((left, right) => String(left.metadata.nextEpisodeAirDate).localeCompare(String(right.metadata.nextEpisodeAirDate)))
      .map(({ metadata, record }) => ({
        item: itemFromAnimeRecord(record!),
        airDate: metadata.nextEpisodeAirDate!,
        name: metadata.nextEpisodeName,
        seasonNumber: metadata.nextEpisodeSeasonNumber,
        episodeNumber: metadata.nextEpisodeEpisodeNumber,
      }))
      .filter((entry): entry is typeof entry & { item: AnimeHubItem } => Boolean(entry.item))
      .slice(0, 18);
    const rated = animeRecords
      .map((item) => item.userRating)
      .filter((rating): rating is number => rating != null);
    const recentlyWatched = animeRecords
      .map((item) => ({
        item,
        watchedAt: item.type === "series"
          ? progressByShow.get(Number(item.tmdbId))?.lastWatchedAt ?? item.watchedAt
          : item.watchedAt,
      }))
      .filter((entry) => entry.watchedAt)
      .sort((left, right) => Number(right.watchedAt) - Number(left.watchedAt))
      .map(({ item }) => itemFromAnimeRecord(item))
      .filter((item): item is AnimeHubItem => Boolean(item))
      .slice(0, 18);

    const movieDiscover = (params: NonNullable<Parameters<typeof tmdb.discoverMovies>[0]>) =>
      tmdb.discoverMovies({
        ...params,
        genres: [ANIMATION_GENRE],
        original_language: "ja",
        language: "en-US",
        page: 1,
      }).then((response) => animeOnly(response.results, "movie"));
    const tvDiscover = (params: NonNullable<Parameters<typeof tmdb.discoverTv>[0]>) =>
      tmdb.discoverTv({
        ...params,
        genres: [ANIMATION_GENRE],
        original_language: "ja",
        language: "en-US",
        page: 1,
      }).then((response) => animeOnly(response.results, "tv"));

    const requests = {
      popularTv: tvDiscover({ sort_by: "popularity.desc", vote_count_gte: 40 }),
      popularMovies: movieDiscover({ sort_by: "popularity.desc", vote_count_gte: 40, release_date_lte: today }),
      seasonal: tvDiscover({
        sort_by: "popularity.desc",
        release_date_gte: dateOnly(seasonStart),
        release_date_lte: dateOnly(seasonEnd),
      }),
      airingToday: tmdb.airingTodayTv(1).then((response) => animeOnly(response.results, "tv")),
      newTv: tvDiscover({ sort_by: "first_air_date.desc", vote_count_gte: 10, release_date_gte: dateOnly(oneYearAgo), release_date_lte: today }),
      newMovies: movieDiscover({ sort_by: "primary_release_date.desc", vote_count_gte: 10, release_date_gte: dateOnly(oneYearAgo), release_date_lte: today }),
      hiddenTv: tvDiscover({ sort_by: "vote_average.desc", vote_average_gte: 7.2, vote_count_gte: 35, release_date_lte: today }),
      hiddenMovies: movieDiscover({ sort_by: "vote_average.desc", vote_average_gte: 7.2, vote_count_gte: 35, release_date_lte: today }),
      upcomingTv: tvDiscover({ sort_by: "first_air_date.asc", release_date_gte: today, release_date_lte: dateOnly(sixMonthsAhead) }),
      upcomingMovies: movieDiscover({ sort_by: "primary_release_date.asc", release_date_gte: today, release_date_lte: dateOnly(sixMonthsAhead) }),
    };
    const keys = Object.keys(requests) as Array<keyof typeof requests>;
    const settled = await Promise.allSettled(Object.values(requests));
    const values = Object.fromEntries(keys.map((key, index) => [
      key,
      settled[index].status === "fulfilled" ? settled[index].value : [],
    ])) as Record<keyof typeof requests, AnimeHubItem[]>;

    const seenKeys = new Set(animeRecords
      .filter((item) => {
        if (item.watched || item.userRating != null) return true;
        if (item.type !== "series") return false;
        return item.status === "watching" || item.status === "uptodate" || item.status === "finished" || item.status === "stopped"
          || (progressByShow.get(Number(item.tmdbId))?.count ?? 0) > 0;
      })
      .filter((item) => item.tmdbId != null)
      .map((item) => `${item.type === "series" ? "tv" : "movie"}:${item.tmdbId}`));
    const featured = dedupe(sortByPopularity([...values.popularTv, ...values.popularMovies]), 40)
      .filter((item) => item.backdrop_path && !seenKeys.has(`${item.media_type}:${item.id}`))
      .slice(0, 5);

    const currentSeason = ["Winter", "Spring", "Summer", "Fall"][Math.floor(now.getMonth() / 3)];
    return NextResponse.json({
      summary: {
        titles: animeRecords.length,
        watchlist: watchlistRecords.length,
        inProgress: inProgressRecords.length,
        watched: watchedRecords.length,
        episodesWatched: episodeProgress.reduce((sum, row) => sum + row._count._all, 0),
        averageRating: rated.length ? Math.round(rated.reduce((sum, rating) => sum + rating, 0) / rated.length) : null,
      },
      currentSeason: `${currentSeason} ${now.getFullYear()}`,
      featured,
      nextEpisodes,
      shelves: {
        watchlist: watchlistRecords.map(itemFromAnimeRecord).filter((item): item is AnimeHubItem => Boolean(item)).slice(0, 18),
        continueWatching: inProgressRecords.map(itemFromAnimeRecord).filter((item): item is AnimeHubItem => Boolean(item)).slice(0, 18),
        airingToday: dedupe(values.airingToday, 18),
        thisSeason: dedupe(values.seasonal, 18),
        newNoteworthy: dedupe(sortByPopularity([...values.newTv, ...values.newMovies]), 18),
        hiddenGems: dedupe(sortByPopularity([...values.hiddenTv, ...values.hiddenMovies]), 18),
        upcoming: dedupe(sortByPopularity([...values.upcomingTv, ...values.upcomingMovies]), 18),
        recentlyWatched,
      },
      partial: settled.some((result) => result.status === "rejected"),
    }, {
      headers: { "Cache-Control": "private, no-store" },
    });
  } catch (error) {
    console.error("[anime-hub]", error);
    return NextResponse.json({ error: "Failed to load the Anime hub." }, { status: 500 });
  }
}
