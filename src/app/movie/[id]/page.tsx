import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { tmdb } from "@/lib/tmdb";

type Props = {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  const movieId = Number(id);
  if (!Number.isInteger(movieId) || movieId <= 0) {
    return { title: "Movie not found" };
  }

  try {
    const movie = await tmdb.movieDetail(movieId);
    const title = movie.title || movie.original_title || "Untitled Movie";
    const year = movie.release_date ? `(${movie.release_date.slice(0, 4)})` : "";
    const fullTitle = year ? `${title} ${year}` : title;
    const description = movie.overview
      ? movie.overview.slice(0, 160)
      : `Details, ratings, and where to watch ${title} on TvTime.`;
    const poster = movie.poster_path
      ? `https://image.tmdb.org/t/p/w500${movie.poster_path}`
      : null;
    const backdrop = movie.backdrop_path
      ? `https://image.tmdb.org/t/p/w1280${movie.backdrop_path}`
      : poster;

    return {
      title: fullTitle,
      description,
      alternates: {
        canonical: `/movie/${movieId}`,
      },
      openGraph: {
        title: `${fullTitle} — TvTime`,
        description,
        type: "video.movie",
        url: `/movie/${movieId}`,
        images: poster
          ? [
              {
                url: poster,
                width: 500,
                height: 750,
                alt: `${title} poster`,
              },
            ]
          : [],
        siteName: "TvTime",
      },
      twitter: {
        card: "summary_large_image",
        title: `${fullTitle} — TvTime`,
        description,
        images: backdrop ? [backdrop] : poster ? [poster] : [],
      },
    };
  } catch {
    // TMDB fetch failed (timeout, 404, etc.) — fall back to a generic title.
    return {
      title: `Movie #${movieId}`,
      description: "Movie details on TvTime.",
    };
  }
}

export default async function MoviePage({ params, searchParams }: Props) {
  const { id } = await params;
  const movieId = Number(id);
  if (!Number.isInteger(movieId) || movieId <= 0) notFound();

  const sp = await searchParams;
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(sp)) {
    if (Array.isArray(value)) value.forEach((item) => query.append(key, item));
    else if (value != null) query.set(key, value);
  }
  return (
    <AppShell
      initialRoute={{
        view: "movie-detail",
        movieId,
        tvId: null,
        personId: null,
      }}
      key={query.toString()}
    />
  );
}
