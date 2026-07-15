import { NextRequest, NextResponse } from "next/server";
import { tmdb } from "@/lib/tmdb";

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
        data = await tmdb.movieGenres();
        break;
      case "movies/discover":
        data = await tmdb.discoverMovies({
          genres: queryParams.genre ? queryParams.genre.split(",").map(Number).filter(Boolean) : undefined,
          year: queryParams.year ? Number(queryParams.year) : undefined,
          sort_by: queryParams.sort_by,
          page: Number(queryParams.page) || 1,
          vote_average_gte: queryParams.rating ? Number(queryParams.rating) : undefined,
          original_language: queryParams.original_language || undefined,
          vote_count_gte: queryParams.vote_count ? Number(queryParams.vote_count) : undefined,
          release_date_gte: queryParams.release_date_gte || undefined,
          release_date_lte: queryParams.release_date_lte || undefined,
        });
        break;
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
      case "tv/genres":
        data = await tmdb.tvGenres();
        break;
      case "tv/discover":
        data = await tmdb.discoverTv({
          genres: queryParams.genre ? queryParams.genre.split(",").map(Number).filter(Boolean) : undefined,
          year: queryParams.year ? Number(queryParams.year) : undefined,
          sort_by: queryParams.sort_by,
          page: Number(queryParams.page) || 1,
          vote_average_gte: queryParams.rating ? Number(queryParams.rating) : undefined,
          original_language: queryParams.original_language || undefined,
          vote_count_gte: queryParams.vote_count ? Number(queryParams.vote_count) : undefined,
        });
        break;
      case "search":
        data = await tmdb.searchMulti(queryParams.q || "", Number(queryParams.page) || 1);
        break;
      default:
        if (segments.match(/^movie\/\d+$/)) {
          const id = Number(segments.split("/")[1]);
          data = await tmdb.movieDetail(id);
        } else if (segments.match(/^tv\/\d+$/)) {
          const id = Number(segments.split("/")[1]);
          data = await tmdb.tvDetail(id);
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

    return NextResponse.json(data);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Unknown error";
    console.error("[TMDB API]", segments, msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
};

export const GET = handler;
