import type { MovieDetail } from "@/lib/tmdb";
import { tmdb } from "@/lib/tmdb";
import { db } from "@/lib/db";

export type TmdbCollectionPart = {
  id: number;
  title?: string;
  original_title?: string;
  poster_path?: string | null;
  release_date?: string;
};

export type TmdbCollectionDetail = {
  id: number;
  name: string;
  poster_path: string | null;
  parts: TmdbCollectionPart[];
};

function orderedParts(parts: TmdbCollectionPart[]) {
  return [...parts].sort((a, b) => {
    const left = String(a.release_date || "9999-99-99");
    const right = String(b.release_date || "9999-99-99");
    return left.localeCompare(right) || a.id - b.id;
  });
}

export async function syncFilmSeriesForMedia(options: {
  userId: string;
  mediaId: string;
  tmdbId: number;
  movie?: MovieDetail | null;
}) {
  const movie = options.movie ?? await tmdb.movieSummary(options.tmdbId);
  const collectionRef = movie.belongs_to_collection;
  if (!collectionRef?.id) {
    await db.media.updateMany({
      where: { id: options.mediaId, userId: options.userId, type: "movie" },
      data: { seriesId: null, seriesPart: null },
    });
    return null;
  }

  const collection = await tmdb.collectionDetail(collectionRef.id);
  const parts = orderedParts(Array.isArray(collection.parts) ? collection.parts : []);
  const partIndex = parts.findIndex((part) => part.id === options.tmdbId);
  const series = await db.filmSeries.upsert({
    where: {
      userId_tmdbCollectionId: {
        userId: options.userId,
        tmdbCollectionId: collection.id,
      },
    },
    create: {
      userId: options.userId,
      tmdbCollectionId: collection.id,
      name: collection.name || collectionRef.name || `Collection ${collection.id}`,
      posterPath: collection.poster_path || collectionRef.poster_path || null,
      totalParts: parts.length,
    },
    update: {
      name: collection.name || collectionRef.name || `Collection ${collection.id}`,
      posterPath: collection.poster_path || collectionRef.poster_path || null,
      totalParts: parts.length,
    },
  });

  await db.media.updateMany({
    where: { id: options.mediaId, userId: options.userId, type: "movie" },
    data: { seriesId: series.id, seriesPart: partIndex >= 0 ? partIndex + 1 : null },
  });

  return { series, parts };
}
