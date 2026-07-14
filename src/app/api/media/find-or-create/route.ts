import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getOrCreateUser, parseUserId } from "@/lib/user";
import { normalizeMedia } from "@/lib/media-normalize";
import { detectIsAnime } from "@/lib/anime-detect";
import { canonicalMediaPoster } from "@/lib/media-poster";
import { detectIsArabic, normalizeCountryCodes } from "@/lib/arabic-media";
import { clientToServer } from "@/lib/media-types";
import { validateBody } from "@/lib/validate";
import { handleError } from "@/lib/api-error";
import { findOrCreateMediaSchema } from "@/lib/schemas/media";

export async function POST(req: NextRequest) {
  try {
    const user = await getOrCreateUser(parseUserId(req));
    const body = await req.json();

    // ── Validate input via zod ──────────────────────────────────────
    const result = validateBody(findOrCreateMediaSchema, body);
    if (result instanceof NextResponse) return result;

    const {
      tmdbId,
      title,
      type,
      poster,
      year,
      overview,
      rating,
      runtime,
      genres,
      seasons,
      episodes,
      isAnime,
      isArabic,
      originCountry,
      originalLanguage,
    } = result;

    const mediaType = clientToServer(type);
    const parsedTmdbId = tmdbId == null ? null : Number(tmdbId);

    const safeTitle = title.trim();
    const normalizedGenres = Array.isArray(genres) ? genres : [];
    const normalizedOriginCountries = normalizeCountryCodes(originCountry);
    const normalizedOriginalLanguage =
      typeof originalLanguage === "string"
        ? originalLanguage.trim().toLowerCase() || null
        : null;
    const hasClassificationMetadata =
      normalizedOriginCountries.length > 0 ||
      normalizedOriginalLanguage != null ||
      normalizedGenres.length > 0;
    let detectedArabic =
      isArabic !== undefined
        ? Boolean(isArabic)
        : detectIsArabic({
            originCountry: normalizedOriginCountries,
            originalLanguage: normalizedOriginalLanguage,
          });
    let detectedAnime =
      isAnime !== undefined
        ? Boolean(isAnime)
        : detectIsAnime({
            originCountry: normalizedOriginCountries,
            originalLanguage: normalizedOriginalLanguage,
            genres: normalizedGenres,
            title: safeTitle,
          });

    // Collection worlds are exclusive. Arabic originals belong to the Arabic
    // Movies/TV worlds even when Animation is one of their genres.
    if (detectedArabic) detectedAnime = false;
    else if (detectedAnime) detectedArabic = false;

    const normalizedPoster = canonicalMediaPoster(poster);

    const createData = {
      userId: user.id,
      tmdbId: parsedTmdbId,
      title: safeTitle,
      type: mediaType,
      poster: normalizedPoster,
      year: year || null,
      overview: overview || null,
      rating: rating != null ? String(rating) : null,
      runtime: runtime != null ? Number(runtime) : null,
      seasons: seasons != null ? Number(seasons) : null,
      episodes: episodes != null ? Number(episodes) : null,
      genres: normalizedGenres,
      isAnime: detectedAnime,
      isArabic: detectedArabic,
      originalLanguage: normalizedOriginalLanguage,
      originCountries: normalizedOriginCountries,
      status: null,
      watched: false,
    };

    let item;

    if (parsedTmdbId != null) {
      // The compound database constraint is the final race-condition guard.
      // Metadata updates never overwrite user tracking/rating state.
      item = await db.media.upsert({
        where: {
          userId_type_tmdbId: {
            userId: user.id,
            type: mediaType,
            tmdbId: parsedTmdbId,
          },
        },
        create: createData,
        update: {
          title: safeTitle,
          ...(normalizedPoster ? { poster: normalizedPoster } : {}),
          ...(year ? { year } : {}),
          ...(overview ? { overview } : {}),
          ...(rating != null ? { rating: String(rating) } : {}),
          ...(runtime != null ? { runtime: Number(runtime) } : {}),
          ...(seasons != null ? { seasons: Number(seasons) } : {}),
          ...(episodes != null ? { episodes: Number(episodes) } : {}),
          ...(normalizedGenres.length > 0 ? { genres: normalizedGenres } : {}),
          ...(normalizedOriginalLanguage ? { originalLanguage: normalizedOriginalLanguage } : {}),
          ...(normalizedOriginCountries.length > 0 ? { originCountries: normalizedOriginCountries } : {}),
          // Explicit moves can set either world. Authoritative TMDB metadata
          // promotes records while keeping Arabic/Anime mutually exclusive.
          ...(isArabic !== undefined
            ? { isArabic: Boolean(isArabic), ...(Boolean(isArabic) ? { isAnime: false } : {}) }
            : hasClassificationMetadata && detectedArabic ? { isArabic: true, isAnime: false } : {}),
          ...(isAnime !== undefined
            ? { isAnime: Boolean(isAnime), ...(Boolean(isAnime) ? { isArabic: false } : {}) }
            : hasClassificationMetadata && detectedAnime ? { isAnime: true, isArabic: false } : {}),
        },
      });
    } else {
      // Non-TMDB items have no stable external identity; retain the existing
      // title-based compatibility behavior without inventing a new key.
      item = await db.media.findFirst({
        where: { userId: user.id, title: { equals: safeTitle }, type: mediaType },
      });

      if (!item) {
        item = await db.media.create({ data: createData });
      } else {
        item = await db.media.update({
          where: { id: item.id },
          data: {
            ...(normalizedPoster ? { poster: normalizedPoster } : {}),
            ...(year ? { year } : {}),
            ...(overview ? { overview } : {}),
            ...(rating != null ? { rating: String(rating) } : {}),
            ...(runtime != null ? { runtime: Number(runtime) } : {}),
            ...(normalizedGenres.length > 0 ? { genres: normalizedGenres } : {}),
            ...(normalizedOriginalLanguage ? { originalLanguage: normalizedOriginalLanguage } : {}),
            ...(normalizedOriginCountries.length > 0 ? { originCountries: normalizedOriginCountries } : {}),
            ...(isArabic !== undefined
              ? { isArabic: Boolean(isArabic), ...(Boolean(isArabic) ? { isAnime: false } : {}) }
              : hasClassificationMetadata && detectedArabic ? { isArabic: true, isAnime: false } : {}),
            ...(isAnime !== undefined
              ? { isAnime: Boolean(isAnime), ...(Boolean(isAnime) ? { isArabic: false } : {}) }
              : hasClassificationMetadata && detectedAnime ? { isAnime: true, isArabic: false } : {}),
          },
        });
      }
    }

    return NextResponse.json({ item: normalizeMedia(item) });
  } catch (error) {
    return handleError(error);
  }
}
