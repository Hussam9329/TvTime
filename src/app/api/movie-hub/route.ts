import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { resolveUserId } from "@/lib/auth";
import { getOrCreateUser } from "@/lib/user";
import { getCanonicalLibraryCounts } from "@/lib/library-counts";
import { resolveGeneralMediaClassifications } from "@/lib/media-classification-resolver-server";
import { discoverArabicShelfByCountryPriority } from "@/lib/arabic-discover";
import { discoverAsianMoviesByPriority } from "@/lib/asian-discover-server";
import {
  filterAndPrioritizeMediaCollectionWorldItems,
  prioritizeMediaCollectionWorldItems,
} from "@/lib/media-world-pipeline";
import { tmdb, type MediaItem, type TmdbLanguage } from "@/lib/tmdb";

type MovieHubWorld = "movies" | "arabic-movies" | "asian-movies";
type TonightMode = "smart" | "under100" | "rated" | "new" | "hidden" | "classic";

const TONIGHT_MODES: TonightMode[] = ["smart", "under100", "rated", "new", "hidden", "classic"];

function parseWorld(value: string | null): MovieHubWorld {
  if (value === "arabic-movies" || value === "asian-movies") return value;
  return "movies";
}

function dateOnly(date: Date) {
  return date.toISOString().slice(0, 10);
}

function movieFromRecord(item: {
  tmdbId: number | null;
  title: string;
  originalTitle: string | null;
  poster: string | null;
  overview: string | null;
  year: string | null;
  rating: string | null;
  runtime: number | null;
  originalLanguage: string | null;
  originCountries: string[];
}): MediaItem & { runtime?: number | null } | null {
  if (!item.tmdbId) return null;
  return {
    id: item.tmdbId,
    title: item.title,
    original_title: item.originalTitle || undefined,
    poster_path: item.poster,
    backdrop_path: null,
    overview: item.overview || "",
    release_date: item.year ? `${item.year.slice(0, 4)}-01-01` : undefined,
    vote_average: Number(item.rating || 0),
    vote_count: 0,
    media_type: "movie",
    popularity: 0,
    original_language: item.originalLanguage || undefined,
    origin_country: item.originCountries,
    runtime: item.runtime,
  };
}

function dedupe(items: MediaItem[], limit = 20) {
  const seen = new Set<number>();
  const result: MediaItem[] = [];
  for (const item of items) {
    if (!item.id || seen.has(item.id) || !item.poster_path) continue;
    seen.add(item.id);
    result.push({ ...item, media_type: "movie" });
    if (result.length >= limit) break;
  }
  return result;
}

export async function GET(req: NextRequest) {
  try {
    const user = await getOrCreateUser(await resolveUserId(req));
    const world = parseWorld(req.nextUrl.searchParams.get("world"));
    const now = new Date();
    const today = dateOnly(now);
    const oneYearAgo = new Date(now);
    oneYearAgo.setFullYear(now.getFullYear() - 1);
    const sixMonthsAhead = new Date(now);
    sixMonthsAhead.setMonth(now.getMonth() + 6);
    const language: TmdbLanguage = world === "arabic-movies" ? "ar" : "en-US";

    const discover = async (params: NonNullable<Parameters<typeof tmdb.discoverMovies>[0]>) => {
      const base = { ...params, language };
      const results = world === "asian-movies"
        ? (await discoverAsianMoviesByPriority(base, 1)).results
        : world === "arabic-movies"
          ? await discoverArabicShelfByCountryPriority("movie", { ...base, original_language: "ar" }, 20)
          : (await tmdb.discoverMovies({ ...base, page: 1 })).results;
      return dedupe(filterAndPrioritizeMediaCollectionWorldItems(results, world), 20);
    };

    const stored = await db.media.findMany({
      where: { userId: user.id, type: "movie" },
      orderBy: { updatedAt: "desc" },
    });
    // Summary numbers MUST come from the canonical counters (the same source
    // used by the Library tab badges, Home overview and Stats page) so the
    // Movies header can never disagree with the rest of the app. Previously
    // these were recomputed inline here, which allowed drift.
    const canonicalCounts = await getCanonicalLibraryCounts(user.id);
    const summaryCounts = world === "arabic-movies"
      ? { watchlist: canonicalCounts.watchlistArabicMovies, watched: canonicalCounts.watchedArabicMovies }
      : world === "asian-movies"
        ? { watchlist: canonicalCounts.watchlistAsianMovies, watched: canonicalCounts.watchedAsianMovies }
        : { watchlist: canonicalCounts.watchlistMovies, watched: canonicalCounts.watchedMovies };
    const classified = await resolveGeneralMediaClassifications(stored, { allowNetwork: false });
    const worldItems = filterAndPrioritizeMediaCollectionWorldItems(classified, world);
    const watchlistBase = worldItems
      .filter((item) => item.status === "planned" && !item.watched)
      .sort((left, right) => right.addedAt.getTime() - left.addedAt.getTime());
    const watchlistRecords = prioritizeMediaCollectionWorldItems(watchlistBase, world);
    const watchlist = watchlistRecords
      .map(movieFromRecord)
      .filter((item): item is NonNullable<typeof item> => Boolean(item))
      .slice(0, 20);
    const recentlyWatchedBase = worldItems
      .filter((item) => item.watched && item.watchedAt)
      .sort((left, right) => Number(right.watchedAt) - Number(left.watchedAt));
    const recentlyWatched = prioritizeMediaCollectionWorldItems(recentlyWatchedBase, world)
      .map(movieFromRecord)
      .filter((item): item is NonNullable<typeof item> => Boolean(item))
      .slice(0, 20);
    const ratings = worldItems.map((item) => item.userRating).filter((rating): rating is number => rating != null);

    const requests = {
      smart: discover({ sort_by: "popularity.desc", vote_count_gte: 100, release_date_lte: today }),
      under100: discover({ sort_by: "popularity.desc", runtime_lte: 100, vote_count_gte: 80, release_date_lte: today }),
      rated: discover({ sort_by: "vote_average.desc", vote_average_gte: 7.5, vote_count_gte: 300, release_date_lte: today }),
      new: discover({ sort_by: "primary_release_date.desc", vote_count_gte: 30, release_date_gte: dateOnly(oneYearAgo), release_date_lte: today }),
      hidden: discover({ sort_by: "vote_average.desc", vote_average_gte: 7, vote_count_gte: 50, release_date_lte: today }),
      classic: discover({ sort_by: "vote_average.desc", vote_count_gte: 200, release_date_lte: "1999-12-31" }),
      comingSoon: discover({ sort_by: "primary_release_date.asc", release_date_gte: today, release_date_lte: dateOnly(sixMonthsAhead) }),
    };
    const settled = await Promise.allSettled(Object.values(requests));
    const values = Object.fromEntries(Object.keys(requests).map((key, index) => [key, settled[index].status === "fulfilled" ? settled[index].value : []])) as Record<keyof typeof requests, MediaItem[]>;
    const excludedFeaturedIds = new Set(
      worldItems
        .filter((item) => item.watched || item.userRating != null)
        .map((item) => item.tmdbId)
        .filter((tmdbId): tmdbId is number => tmdbId != null),
    );
    const featuredBase = values.smart
      .filter((item) => item.backdrop_path && !excludedFeaturedIds.has(item.id))
      .slice(0, 3);
    const featured = await Promise.all(featuredBase.map(async (item) => {
      try {
        const detail = await tmdb.movieSummary(item.id, language);
        return { ...item, runtime: detail.runtime ?? null };
      } catch {
        return item;
      }
    }));

    const tonight = Object.fromEntries(TONIGHT_MODES.map((mode) => [mode, values[mode].slice(0, 14)]));
    return NextResponse.json({
      world,
      summary: {
        watchlist: summaryCounts.watchlist,
        watched: summaryCounts.watched,
        averageRating: ratings.length ? Math.round(ratings.reduce((sum, rating) => sum + rating, 0) / ratings.length) : null,
      },
      featured,
      shelves: {
        watchlist,
        tonight,
        newNoteworthy: values.new.slice(0, 14),
        hiddenGems: values.hidden.slice(0, 14),
        recentlyWatched,
        comingSoon: values.comingSoon.slice(0, 14),
      },
      partial: settled.some((result) => result.status === "rejected"),
    }, {
      headers: { "Cache-Control": "private, no-store" },
    });
  } catch (error) {
    console.error("[movie-hub]", error);
    return NextResponse.json({ error: "Failed to load the movie hub." }, { status: 500 });
  }
}
