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
  const tvId = Number(id);
  if (!Number.isInteger(tvId) || tvId <= 0) {
    return { title: "TV Show not found" };
  }

  try {
    const show = await tmdb.tvDetail(tvId);
    const title = show.name || show.original_name || "Untitled TV Show";
    const year = show.first_air_date ? `(${show.first_air_date.slice(0, 4)})` : "";
    const fullTitle = year ? `${title} ${year}` : title;
    const description = show.overview
      ? show.overview.slice(0, 160)
      : `Track episodes, ratings, and where to watch ${title} on TvTime.`;
    const poster = show.poster_path
      ? `https://image.tmdb.org/t/p/w500${show.poster_path}`
      : null;
    const backdrop = show.backdrop_path
      ? `https://image.tmdb.org/t/p/w1280${show.backdrop_path}`
      : poster;

    return {
      title: fullTitle,
      description,
      alternates: {
        canonical: `/tv/${tvId}`,
      },
      openGraph: {
        title: `${fullTitle} — TvTime`,
        description,
        type: "video.tv_show",
        url: `/tv/${tvId}`,
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
    return {
      title: `TV Show #${tvId}`,
      description: "TV show details on TvTime.",
    };
  }
}

export default async function TvPage({ params, searchParams }: Props) {
  const { id } = await params;
  const tvId = Number(id);
  if (!Number.isInteger(tvId) || tvId <= 0) notFound();

  const sp = await searchParams;
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(sp)) {
    if (Array.isArray(value)) value.forEach((item) => query.append(key, item));
    else if (value != null) query.set(key, value);
  }
  return (
    <AppShell
      initialRoute={{
        view: "tv-detail",
        movieId: null,
        tvId,
        personId: null,
      }}
      key={query.toString()}
    />
  );
}
