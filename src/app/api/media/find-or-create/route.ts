import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getOrCreateUser } from "@/lib/user";
import { resolveUserId } from "@/lib/auth";
import { normalizeMedia } from "@/lib/media-normalize";
import { canonicalMediaPoster } from "@/lib/media-poster";
import { normalizeCountryCodes } from "@/lib/arabic-media";
import { classifyMediaWorld } from "@/lib/media-world-classification";

function normalizeGenreForStorage(genre: unknown): string | null {
  if (typeof genre === "number") {
    if (!Number.isFinite(genre)) return null;
    return genre === 16 ? "Animation" : String(genre);
  }

  if (genre && typeof genre === "object") {
    const candidate = genre as { id?: unknown; name?: unknown };
    const name = typeof candidate.name === "string" ? candidate.name.trim() : "";
    if (name) return name;
    const id = Number(candidate.id);
    if (Number.isFinite(id)) return id === 16 ? "Animation" : String(id);
    return null;
  }

  const value = String(genre ?? "").trim();
  if (!value) return null;
  return value === "16" ? "Animation" : value;
}

export async function POST(req: NextRequest) {
  try {
    const user = await getOrCreateUser(await resolveUserId(req));
    const body = await req.json();
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
      genreIds,
      seasons,
      episodes,
      isAnime,
      isArabic,
      originCountry,
      originalLanguage,
    } = body;

    if (!title || typeof title !== "string") {
      return NextResponse.json({ error: "title required" }, { status: 400 });
    }

    const mediaType = type === "tv" ? "series" : type || "movie";
    const parsedTmdbId = tmdbId == null || tmdbId === "" ? null : Number(tmdbId);
    if (parsedTmdbId != null && (!Number.isInteger(parsedTmdbId) || parsedTmdbId <= 0)) {
      return NextResponse.json({ error: "tmdbId must be a positive integer" }, { status: 400 });
    }

    const safeTitle = title.trim();
    if (!safeTitle) {
      return NextResponse.json({ error: "title required" }, { status: 400 });
    }
    const rawGenres = [
      ...(Array.isArray(genres) ? genres : []),
      ...(Array.isArray(genreIds) ? genreIds : []),
      ...(Array.isArray(body.genre_ids) ? body.genre_ids : []),
    ];
    const normalizedGenres = Array.from(new Set(
      rawGenres
        .map(normalizeGenreForStorage)
        .filter((genre): genre is string => genre !== null),
    ));
    const normalizedOriginCountries = normalizeCountryCodes(originCountry || body.origin_country);
    const normalizedOriginalLanguage = typeof (originalLanguage || body.original_language) === "string"
      ? String(originalLanguage || body.original_language).trim().toLowerCase() || null
      : null;
    const hasClassificationMetadata = normalizedOriginCountries.length > 0
      || normalizedOriginalLanguage != null
      || normalizedGenres.length > 0;
    const canonicalClassification = classifyMediaWorld({
      type: mediaType,
      title: safeTitle,
      originalLanguage: normalizedOriginalLanguage,
      originCountries: normalizedOriginCountries,
      genres: normalizedGenres,
      isAnime: isAnime === undefined ? false : Boolean(isAnime),
      isArabic: isArabic === undefined ? false : Boolean(isArabic),
      // Metadata wins over caller-supplied flags. Explicit flags remain only
      // as a legacy fallback when the request contains no classification data.
      classificationComplete: hasClassificationMetadata,
    });
    const detectedArabic = canonicalClassification.isArabic;
    const detectedAnime = canonicalClassification.isAnime;
    const classificationFlags = isArabic !== undefined
      || isAnime !== undefined
      || hasClassificationMetadata
      ? { isArabic: detectedArabic, isAnime: detectedAnime }
      : {};

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
      const existingIdentity = await db.media.findUnique({
        where: { userId_type_tmdbId: { userId: user.id, type: mediaType, tmdbId: parsedTmdbId } },
        select: { poster: true },
      });
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
          ...(!existingIdentity?.poster && normalizedPoster ? { poster: normalizedPoster } : {}),
          ...(year ? { year } : {}),
          ...(overview ? { overview } : {}),
          ...(rating != null ? { rating: String(rating) } : {}),
          ...(runtime != null ? { runtime: Number(runtime) } : {}),
          ...(seasons != null ? { seasons: Number(seasons) } : {}),
          ...(episodes != null ? { episodes: Number(episodes) } : {}),
          ...(normalizedGenres.length > 0 ? { genres: normalizedGenres } : {}),
          ...(normalizedOriginalLanguage ? { originalLanguage: normalizedOriginalLanguage } : {}),
          ...(normalizedOriginCountries.length > 0 ? { originCountries: normalizedOriginCountries } : {}),
          // Authoritative metadata may both promote and demote stale world
          // flags; merely preserving old true values causes cross-world leaks.
          ...classificationFlags,
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
            ...(!item.poster && normalizedPoster ? { poster: normalizedPoster } : {}),
            ...(year ? { year } : {}),
            ...(overview ? { overview } : {}),
            ...(rating != null ? { rating: String(rating) } : {}),
            ...(runtime != null ? { runtime: Number(runtime) } : {}),
            ...(normalizedGenres.length > 0 ? { genres: normalizedGenres } : {}),
            ...(normalizedOriginalLanguage ? { originalLanguage: normalizedOriginalLanguage } : {}),
            ...(normalizedOriginCountries.length > 0 ? { originCountries: normalizedOriginCountries } : {}),
            ...classificationFlags,
          },
        });
      }
    }

    return NextResponse.json({ item: normalizeMedia(item) });
  } catch (error) {
    console.error("[media:find-or-create]", error);
    return NextResponse.json({ error: "Failed to save media item" }, { status: 500 });
  }
}
