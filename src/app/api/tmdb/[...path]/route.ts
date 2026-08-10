import { NextRequest, NextResponse } from "next/server";
import { resolveTmdbKeywordIds, tmdb, type MediaItem, type TmdbLanguage } from "@/lib/tmdb";
import { filterAndPrioritizeArabicMediaItems, isArabicMediaItem } from "@/lib/arabic-media";
import { discoverArabicByCountryPriority } from "@/lib/arabic-discover";
import { ASIAN_ORIGIN_COUNTRY_QUERY } from "@/lib/asian-media";
import { discoverAsianMoviesByPriority, discoverAsianTvByPriority } from "@/lib/asian-discover-server";
import { matchesDiscoverWorld, type DiscoverWorld } from "@/lib/discover-world";
import { sortByStandardMediaPriority } from "@/lib/standard-media-priority";

const handler = async (
  req: NextRequest,
  { params }: { params: Promise<{ path: string[] }> }
) => {
  const { path } = await params;
  const segments = path.join("/");
  const url = new URL(req.url);
  const queryParams = Object.fromEntries(url.searchParams.entries());

  try {
    let data: unknown;

    switch (segments) {
      case "trending":
        data = await tmdb.trending(
          (queryParams.window as "day" | "week") || "week",
          (queryParams.type as "all" | "movie" | "tv") || "all"
        );
        break;
      case "home": {
        const [trending, popularMovies, topRatedMovies, upcomingMovies, popularTv, onTheAirTv, topRatedTv] = await Promise.all([
          tmdb.trending("week", "all"),
          tmdb.popularMovies(1),
          tmdb.topRatedMovies(1),
          tmdb.upcomingMovies(1),
          tmdb.popularTv(1),
          tmdb.onTheAirTv(1),
          tmdb.topRatedTv(1),
        ]);
        data = {
          trending,
          popularMovies,
          topRatedMovies,
          upcomingMovies,
          popularTv,
          onTheAirTv,
          topRatedTv,
        };
        break;
      }
      case "movies/popular":
        data = await tmdb.popularMovies(Number(queryParams.page) || 1);
        break;
      case "movies/top-rated":
        data = await tmdb.topRatedMovies(Number(queryParams.page) || 1);
        break;
      case "movies/now-playing":
        data = await tmdb.nowPlayingMovies(Number(queryParams.page) || 1);
        break;
      case "movies/upcoming":
        data = await tmdb.upcomingMovies(Number(queryParams.page) || 1);
        break;
      case "movies/genres":
        data = await tmdb.movieGenres((queryParams.language as TmdbLanguage) || undefined);
        break;
      case "movies/discover": {
        const page = Number(queryParams.page) || 1;
        const language = (queryParams.language as TmdbLanguage) || undefined;
        const keywordQuery = queryParams.keyword_query?.trim();
        const keywordIds = keywordQuery ? await resolveTmdbKeywordIds(keywordQuery, language) : undefined;
        if (keywordQuery && keywordIds?.length === 0) {
          data = { page, results: [], total_pages: 0, total_results: 0 };
          break;
        }
        const discoverParams = {
          genres: queryParams.genre ? queryParams.genre.split(",").map(Number).filter(Boolean) : undefined,
          year: queryParams.year ? Number(queryParams.year) : undefined,
          sort_by: queryParams.sort_by,
          page,
          vote_average_gte: queryParams.rating ? Number(queryParams.rating) : undefined,
          vote_average_lte: queryParams.rating_max != null ? Number(queryParams.rating_max) : undefined,
          original_language: queryParams.original_language || undefined,
          originCountries: queryParams.origin_country || undefined,
          vote_count_gte: queryParams.vote_count != null ? Number(queryParams.vote_count) : undefined,
          release_date_gte: queryParams.release_date_gte || undefined,
          release_date_lte: queryParams.release_date_lte || undefined,
          certification: queryParams.certification || undefined,
          runtime_gte: queryParams.runtime_gte ? Number(queryParams.runtime_gte) : undefined,
          runtime_lte: queryParams.runtime_lte ? Number(queryParams.runtime_lte) : undefined,
          keyword_ids: keywordIds,
          language,
        };
        if (queryParams.origin_country === ASIAN_ORIGIN_COUNTRY_QUERY) {
          data = await discoverAsianMoviesByPriority(discoverParams, page);
        } else if (queryParams.original_language === "ar") {
          data = await discoverArabicByCountryPriority("movie", discoverParams, page);
        } else {
          const discovered = await tmdb.discoverMovies(discoverParams);
          data = { ...discovered, results: sortByStandardMediaPriority(discovered.results) };
        }
        break;
      }
      case "tv/popular":
        data = await tmdb.popularTv(Number(queryParams.page) || 1);
        break;
      case "tv/top-rated":
        data = await tmdb.topRatedTv(Number(queryParams.page) || 1);
        break;
      case "tv/on-the-air":
        data = await tmdb.onTheAirTv(Number(queryParams.page) || 1);
        break;
      case "tv/airing-today":
        data = await tmdb.airingTodayTv(Number(queryParams.page) || 1);
        break;
      case "tv/hub": {
        const world: DiscoverWorld = queryParams.world === "arabic" || queryParams.world === "asian"
          ? queryParams.world
          : "standard";
        const language: TmdbLanguage = world === "arabic" ? "ar" : "en-US";
        const now = new Date();
        const today = now.toISOString().slice(0, 10);
        const oneYearAgo = new Date(now);
        oneYearAgo.setFullYear(now.getFullYear() - 1);

        const worldItems = (items: MediaItem[], limit = 20) => {
          const seen = new Set<number>();
          const result: MediaItem[] = [];
          const candidates = world === "arabic"
            ? filterAndPrioritizeArabicMediaItems(items)
            : items;
          for (const item of candidates) {
            if (!item.id || seen.has(item.id) || !item.poster_path || !matchesDiscoverWorld(item, "tv", world)) continue;
            seen.add(item.id);
            result.push({ ...item, media_type: "tv" });
            if (result.length >= limit) break;
          }
          return result;
        };
        const discover = async (params: NonNullable<Parameters<typeof tmdb.discoverTv>[0]>) => {
          const base = { ...params, page: 1, language };
          const response = world === "asian"
            ? await discoverAsianTvByPriority(base, 1)
            : world === "arabic"
              ? await discoverArabicByCountryPriority("tv", { ...base, original_language: "ar" }, 1)
              : await tmdb.discoverTv(base);
          return worldItems(response.results);
        };
        const requests = [
          discover({ sort_by: "popularity.desc", vote_count_gte: 80 }),
          discover({
            sort_by: "first_air_date.desc",
            vote_count_gte: 20,
            release_date_gte: oneYearAgo.toISOString().slice(0, 10),
            release_date_lte: today,
          }),
          discover({ sort_by: "vote_average.desc", vote_average_gte: 7.2, vote_count_gte: 50, release_date_lte: today }),
          tmdb.airingTodayTv(1).then((response) => worldItems(response.results)),
          tmdb.onTheAirTv(1).then((response) => worldItems(response.results)),
        ] as const;
        const settled = await Promise.allSettled(requests);
        const value = (index: number) => settled[index].status === "fulfilled" ? settled[index].value : [];
        const airingToday = value(3);
        data = {
          world,
          popular: value(0),
          newNoteworthy: value(1),
          hiddenGems: value(2),
          airingToday: airingToday.length > 0 ? airingToday : value(4),
          partial: settled.some((result) => result.status === "rejected"),
        };
        break;
      }
      case "tv/genres":
        data = await tmdb.tvGenres((queryParams.language as TmdbLanguage) || undefined);
        break;
      case "tv/discover": {
        const page = Number(queryParams.page) || 1;
        const language = (queryParams.language as TmdbLanguage) || undefined;
        const keywordQuery = queryParams.keyword_query?.trim();
        const keywordIds = keywordQuery ? await resolveTmdbKeywordIds(keywordQuery, language) : undefined;
        if (keywordQuery && keywordIds?.length === 0) {
          data = { page, results: [], total_pages: 0, total_results: 0 };
          break;
        }
        const discoverParams = {
          genres: queryParams.genre ? queryParams.genre.split(",").map(Number).filter(Boolean) : undefined,
          year: queryParams.year ? Number(queryParams.year) : undefined,
          sort_by: queryParams.sort_by,
          page,
          vote_average_gte: queryParams.rating ? Number(queryParams.rating) : undefined,
          vote_average_lte: queryParams.rating_max != null ? Number(queryParams.rating_max) : undefined,
          original_language: queryParams.original_language || undefined,
          vote_count_gte: queryParams.vote_count != null ? Number(queryParams.vote_count) : undefined,
          release_date_gte: queryParams.release_date_gte || undefined,
          release_date_lte: queryParams.release_date_lte || undefined,
          runtime_gte: queryParams.runtime_gte ? Number(queryParams.runtime_gte) : undefined,
          runtime_lte: queryParams.runtime_lte ? Number(queryParams.runtime_lte) : undefined,
          keyword_ids: keywordIds,
          language,
        };
        data = queryParams.origin_country === ASIAN_ORIGIN_COUNTRY_QUERY
          ? await discoverAsianTvByPriority(discoverParams, page)
          : queryParams.original_language === "ar"
          ? await discoverArabicByCountryPriority("tv", discoverParams, page)
          : await tmdb.discoverTv(discoverParams);
        break;
      }
      case "search":
        data = await tmdb.searchMulti(queryParams.q || "", Number(queryParams.page) || 1);
        break;
      default:
        if (segments.match(/^movie\/\d+$/)) {
          const id = Number(segments.split("/")[1]);
          const language = (queryParams.language as TmdbLanguage) || undefined;
          if (language === "ar") {
            const [arabicProfile, englishProfile] = await Promise.all([
              tmdb.movieDetail(id, "ar"),
              tmdb.movieDetail(id, "en-US"),
            ]);
            data = { ...arabicProfile, english_title: englishProfile.title || englishProfile.original_title };
          } else {
            data = await tmdb.movieDetail(id, language);
            if (!language && isArabicMediaItem(data as any)) {
              const arabicProfile = await tmdb.movieDetail(id, "ar");
              data = { ...arabicProfile, english_title: (data as any).title || (data as any).original_title };
            }
          }
        } else if (segments.match(/^tv\/\d+$/)) {
          const id = Number(segments.split("/")[1]);
          const language = (queryParams.language as TmdbLanguage) || undefined;
          if (language === "ar") {
            const [arabicProfile, englishProfile] = await Promise.all([
              tmdb.tvDetail(id, "ar"),
              tmdb.tvDetail(id, "en-US"),
            ]);
            data = { ...arabicProfile, english_name: englishProfile.name || englishProfile.original_name };
          } else {
            data = await tmdb.tvDetail(id, language);
            if (!language && isArabicMediaItem(data as any)) {
              const arabicProfile = await tmdb.tvDetail(id, "ar");
              data = { ...arabicProfile, english_name: (data as any).name || (data as any).original_name };
            }
          }
        } else if (segments.match(/^tv\/\d+\/season\/\d+$/)) {
          const parts = segments.split("/");
          data = await tmdb.seasonDetail(Number(parts[1]), Number(parts[3]));
        } else if (segments.match(/^person\/\d+$/)) {
          const id = Number(segments.split("/")[1]);
          data = await tmdb.personDetail(id);
        } else {
          return NextResponse.json({ error: "Unknown endpoint: " + segments }, { status: 404 });
        }
    }

    const response = NextResponse.json(data);
    const browserMaxAge = segments === "search" ? 60 : 300;
    response.headers.set(
      "Cache-Control",
      `public, max-age=${browserMaxAge}, s-maxage=${browserMaxAge}, stale-while-revalidate=900`,
    );
    return response;
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Unknown error";
    console.error("[TMDB API]", segments, msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
};

export const GET = handler;
