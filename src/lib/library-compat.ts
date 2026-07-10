import { normalizeMedia } from "@/lib/media-normalize";

export function mediaToLegacyLibraryItem(item: Record<string, any>) {
  const media = normalizeMedia(item);
  const mediaType = media.type === "series" ? "tv" : media.type;
  return {
    ...media,
    mediaType,
    posterPath: media.poster ?? null,
    backdropPath: null,
    releaseDate: media.year ? `${media.year}-01-01` : null,
    voteAverage: media.rating == null ? null : Number(media.rating),
    followedAt: media.addedAt ?? media.updatedAt,
    value: media.userRating == null ? undefined : Math.round(media.userRating / 10),
  };
}
