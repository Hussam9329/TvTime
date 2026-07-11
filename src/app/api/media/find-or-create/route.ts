import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getOrCreateUser, parseUserId } from "@/lib/user";
import { normalizeMedia } from "@/lib/media-normalize";
import { detectIsAnime } from "@/lib/anime-detect";

export async function POST(req: NextRequest) {
  try {
    const user = await getOrCreateUser(parseUserId(req));
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
      seasons,
      episodes,
      isAnime,
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
    const normalizedGenres = Array.isArray(genres)
      ? genres.map((genre: unknown) => String(genre).trim()).filter(Boolean)
      : [];
    const hasAnimeMetadata = Array.isArray(originCountry || body.origin_country)
      || typeof (originalLanguage || body.original_language) === "string"
      || normalizedGenres.length > 0;
    const detectedAnime = isAnime !== undefined
      ? Boolean(isAnime)
      : detectIsAnime({
          originCountry: originCountry || body.origin_country,
          originalLanguage: originalLanguage || body.original_language,
          genres: normalizedGenres,
          title: safeTitle,
        });

    const createData = {
      userId: user.id,
      tmdbId: parsedTmdbId,
      title: safeTitle,
      type: mediaType,
      poster: poster || null,
      year: year || null,
      overview: overview || null,
      rating: rating != null ? String(rating) : null,
      runtime: runtime != null ? Number(runtime) : null,
      seasons: seasons != null ? Number(seasons) : null,
      episodes: episodes != null ? Number(episodes) : null,
      genres: normalizedGenres,
      isAnime: detectedAnime,
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
          ...(poster ? { poster } : {}),
          ...(year ? { year } : {}),
          ...(overview ? { overview } : {}),
          ...(rating != null ? { rating: String(rating) } : {}),
          ...(runtime != null ? { runtime: Number(runtime) } : {}),
          ...(seasons != null ? { seasons: Number(seasons) } : {}),
          ...(episodes != null ? { episodes: Number(episodes) } : {}),
          ...(normalizedGenres.length > 0 ? { genres: normalizedGenres } : {}),
          // Authoritative TMDB metadata can promote a previously misclassified
          // item to Anime. It never auto-demotes a manual Anime classification.
          ...(isAnime !== undefined
            ? { isAnime: Boolean(isAnime) }
            : hasAnimeMetadata && detectedAnime ? { isAnime: true } : {}),
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
            ...(poster ? { poster } : {}),
            ...(year ? { year } : {}),
            ...(overview ? { overview } : {}),
            ...(rating != null ? { rating: String(rating) } : {}),
            ...(runtime != null ? { runtime: Number(runtime) } : {}),
            ...(normalizedGenres.length > 0 ? { genres: normalizedGenres } : {}),
            ...(isAnime !== undefined
              ? { isAnime: Boolean(isAnime) }
              : hasAnimeMetadata && detectedAnime ? { isAnime: true } : {}),
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
