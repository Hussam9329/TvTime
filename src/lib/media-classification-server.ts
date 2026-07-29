import type { Prisma } from "@prisma/client";
import { detectIsAnime } from "@/lib/anime-detect";
import { ASIAN_COUNTRY_CODES, ASIAN_LANGUAGE_CODES } from "@/lib/asian-media";

const animationGenres = ["Animation", "Anime", "animation", "anime"];

export const INFERRED_ANIME_WHERE: Prisma.MediaWhereInput = {
  OR: [
    { isAnime: true },
    { title: { contains: "Agatha Christie's Great Detectives Poirot and Marple", mode: "insensitive" } },
    {
      AND: [
        { OR: [{ originalLanguage: "ja" }, { originCountries: { has: "JP" } }] },
        { OR: animationGenres.map((genre) => ({ genres: { has: genre } })) },
      ],
    },
  ],
};

export const INFERRED_NON_ANIME_WHERE: Prisma.MediaWhereInput = {
  NOT: INFERRED_ANIME_WHERE,
};

export const INFERRED_ASIAN_TV_WHERE: Prisma.MediaWhereInput = {
  type: "series",
  isArabic: false,
  AND: [
    INFERRED_NON_ANIME_WHERE,
    {
      OR: [
        ...ASIAN_COUNTRY_CODES.map((country) => ({ originCountries: { has: country } })),
        {
          AND: [
            { originCountries: { isEmpty: true } },
            { originalLanguage: { in: [...ASIAN_LANGUAGE_CODES] } },
          ],
        },
      ],
    },
  ],
};

export const INFERRED_NON_ASIAN_TV_WHERE: Prisma.MediaWhereInput = { NOT: INFERRED_ASIAN_TV_WHERE };

export function classifyStoredMediaAsAnime(media: {
  title?: string | null;
  isAnime?: boolean | null;
  originalLanguage?: string | null;
  originCountries?: string[] | null;
  genres?: string[] | null;
}) {
  return Boolean(media.isAnime) || detectIsAnime({
    title: media.title || undefined,
    originalLanguage: media.originalLanguage,
    originCountry: media.originCountries,
    genres: media.genres,
  });
}
