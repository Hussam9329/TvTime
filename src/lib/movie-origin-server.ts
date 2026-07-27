import { tmdb, type MediaItem, type TmdbLanguage } from "@/lib/tmdb";

export async function enrichMovieOriginCountries(
  items: MediaItem[],
  language?: TmdbLanguage,
): Promise<MediaItem[]> {
  return Promise.all(items.map(async (item) => {
    if (item.origin_country?.length) return item;

    try {
      const detail = await tmdb.movieDetail(Number(item.id), language);
      const originCountry = detail.production_countries
        ?.map((country) => country.iso_3166_1)
        .filter(Boolean);
      return originCountry?.length ? { ...item, origin_country: originCountry } : item;
    } catch {
      return item;
    }
  }));
}
