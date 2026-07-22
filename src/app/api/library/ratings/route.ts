import { NextRequest, NextResponse } from "next/server";
import type { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { getOrCreateUser, parseUserId } from "@/lib/user";
import {
  clampRatingOutOf100,
  episodeRatingMediaType,
  parseEpisodeRatingMediaType,
} from "@/lib/episode-rating";
import { validateReleasedEpisodeBatch } from "@/lib/tv-status-server";
import { getTvRatingEligibility, tvRatingEligibilityError } from "@/lib/tv-rating-eligibility";

function positiveInteger(value: unknown): number | null {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
}

function canonicalType(mediaType: string) {
  return mediaType === "tv" || mediaType === "series" ? "series" : "movie";
}

function titleRatingValueOutOf100(value: unknown) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return null;
  return Math.max(0, Math.min(100, numeric <= 10 ? numeric * 10 : numeric));
}

function titleRatingCompat(item: any) {
  return {
    id: item.id,
    userId: item.userId,
    mediaType: item.type === "series" ? "tv" : "movie",
    tmdbId: item.tmdbId,
    title: item.title,
    posterPath: item.poster,
    value: item.userRating == null ? null : item.userRating / 10,
    valueOutOf100: item.userRating,
    createdAt: item.addedAt,
    updatedAt: item.updatedAt,
    scope: "title",
    source: "Media",
  };
}

// GET - title ratings come from Media.userRating. Rating is retained only for
// independent episode ratings.
export async function GET(req: NextRequest) {
  try {
    const user = await getOrCreateUser(parseUserId(req));
    const url = new URL(req.url);
    const mediaType = url.searchParams.get("mediaType");
    const showId = positiveInteger(url.searchParams.get("showId"));
    const seasonNumber = positiveInteger(url.searchParams.get("seasonNumber"));
    const episodeNumber = positiveInteger(url.searchParams.get("episodeNumber"));

    if (mediaType === "episode") {
      if (!showId) return NextResponse.json({ error: "showId required for episode ratings" }, { status: 400 });
      const where: Prisma.RatingWhereInput = {
        userId: user.id,
        tmdbId: showId,
        mediaType: seasonNumber && episodeNumber
          ? episodeRatingMediaType(seasonNumber, episodeNumber)
          : { startsWith: "episode:" },
      };
      const items = await db.rating.findMany({ where, orderBy: { updatedAt: "desc" } });
      return NextResponse.json({
        items: items.map((item) => {
          const identity = parseEpisodeRatingMediaType(item.mediaType);
          return identity ? { ...item, showId: item.tmdbId, ...identity, scope: "episode" } : item;
        }),
        source: "Rating:episode-only",
      });
    }

    const type = mediaType ? canonicalType(mediaType) : null;
    const titleItems = await db.media.findMany({
      where: type === "series"
        ? { userId: user.id, type: "series", status: "finished", userRating: { not: null } }
        : type === "movie"
          ? { userId: user.id, type: "movie", userRating: { not: null } }
          : {
              userId: user.id,
              userRating: { not: null },
              OR: [
                { type: "movie" },
                { type: "series", status: "finished" },
              ],
            },
      orderBy: { updatedAt: "desc" },
    });

    if (mediaType) return NextResponse.json({ items: titleItems.map(titleRatingCompat), source: "Media" });

    const episodeItems = await db.rating.findMany({
      where: { userId: user.id, mediaType: { startsWith: "episode:" } },
      orderBy: { updatedAt: "desc" },
    });
    return NextResponse.json({
      items: [
        ...titleItems.map(titleRatingCompat),
        ...episodeItems.map((item) => {
          const identity = parseEpisodeRatingMediaType(item.mediaType);
          return identity ? { ...item, showId: item.tmdbId, ...identity, scope: "episode" } : item;
        }),
      ],
      source: "Media+Rating:episode-only",
    });
  } catch (error) {
    console.error("[ratings:GET]", error);
    return NextResponse.json({ error: "Failed to load ratings" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await getOrCreateUser(parseUserId(req));
    const body = await req.json();

    if (body.mediaType === "episode") {
      const showId = positiveInteger(body.showId ?? body.tmdbId);
      const seasonNumber = positiveInteger(body.seasonNumber);
      const episodeNumber = positiveInteger(body.episodeNumber);
      if (!showId || !seasonNumber || !episodeNumber || body.value == null) {
        return NextResponse.json(
          { error: "showId, seasonNumber, episodeNumber and value are required" },
          { status: 400 },
        );
      }

      const [validation, watchedEpisode] = await Promise.all([
        validateReleasedEpisodeBatch(showId, [{ seasonNumber, episodeNumber }]),
        db.watchedEpisode.findFirst({
          where: { userId: user.id, showId, seasonNumber, episodeNumber },
          select: { id: true, episodeName: true },
        }),
      ]);

      if (validation.released.length !== 1 || validation.blocked.length > 0) {
        return NextResponse.json(
          { error: "An episode can only be rated after it has aired.", code: "EPISODE_RATING_REQUIRES_RELEASE" },
          { status: 409 },
        );
      }
      if (!watchedEpisode) {
        return NextResponse.json(
          { error: "Mark this episode as watched before rating it.", code: "EPISODE_RATING_REQUIRES_WATCHED" },
          { status: 409 },
        );
      }

      const released = validation.released[0];
      const value = clampRatingOutOf100(body.value);
      const encodedMediaType = episodeRatingMediaType(seasonNumber, episodeNumber);
      const showTitle = typeof body.showTitle === "string" && body.showTitle.trim()
        ? body.showTitle.trim()
        : `TV Show #${showId}`;
      const episodeName = typeof body.episodeName === "string" && body.episodeName.trim()
        ? body.episodeName.trim()
        : watchedEpisode.episodeName || released.episodeName || `Episode ${episodeNumber}`;

      const item = await db.rating.upsert({
        where: { userId_mediaType_tmdbId: { userId: user.id, mediaType: encodedMediaType, tmdbId: showId } },
        create: {
          userId: user.id,
          mediaType: encodedMediaType,
          tmdbId: showId,
          title: `${showTitle} — S${seasonNumber}E${episodeNumber}: ${episodeName}`,
          posterPath: body.posterPath || null,
          value,
        },
        update: {
          value,
          title: `${showTitle} — S${seasonNumber}E${episodeNumber}: ${episodeName}`,
          ...(body.posterPath !== undefined ? { posterPath: body.posterPath || null } : {}),
        },
      });
      return NextResponse.json({ item: { ...item, showId, seasonNumber, episodeNumber, scope: "episode" } });
    }

    const mediaType = String(body.mediaType || "");
    const tmdbId = positiveInteger(body.tmdbId);
    const value = titleRatingValueOutOf100(body.value);
    if (!mediaType || !tmdbId || value == null) {
      return NextResponse.json({ error: "mediaType, tmdbId, value required" }, { status: 400 });
    }
    const type = canonicalType(mediaType);

    if (type === "series") {
      const eligibility = await getTvRatingEligibility(user.id, tmdbId);
      if (!eligibility.allowed) {
        const failure = tvRatingEligibilityError(eligibility);
        return NextResponse.json(
          {
            error: failure.message,
            code: failure.code,
            totalEpisodes: eligibility.totalEpisodes,
            watchedEpisodes: eligibility.watchedEpisodes,
            tmdbStatus: eligibility.tmdbStatus,
          },
          { status: 409 },
        );
      }
    }

    const existingTitle = await db.media.findUnique({ where: { userId_type_tmdbId: { userId: user.id, type, tmdbId } }, select: { poster: true } });
    const item = await db.media.upsert({
      where: {
        userId_type_tmdbId: { userId: user.id, type, tmdbId },
      },
      create: {
        userId: user.id,
        type,
        tmdbId,
        title: body.title || "Unknown",
        poster: body.posterPath || null,
        userRating: value,
        watched: false,
        status: null,
      },
      update: {
        userRating: value,
        ...(body.title ? { title: body.title } : {}),
        ...(!existingTitle?.poster && body.posterPath !== undefined ? { poster: body.posterPath || null } : {}),
      },
    });
    return NextResponse.json({ item: titleRatingCompat(item), source: "Media" });
  } catch (error) {
    console.error("[ratings:POST]", error);
    return NextResponse.json({ error: "Failed to save rating" }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const user = await getOrCreateUser(parseUserId(req));
    const url = new URL(req.url);
    const mediaType = url.searchParams.get("mediaType");

    if (mediaType === "episode") {
      const showId = positiveInteger(url.searchParams.get("showId") ?? url.searchParams.get("tmdbId"));
      const seasonNumber = positiveInteger(url.searchParams.get("seasonNumber"));
      const episodeNumber = positiveInteger(url.searchParams.get("episodeNumber"));
      if (!showId || !seasonNumber || !episodeNumber) {
        return NextResponse.json({ error: "showId, seasonNumber and episodeNumber required" }, { status: 400 });
      }
      await db.rating.deleteMany({
        where: { userId: user.id, tmdbId: showId, mediaType: episodeRatingMediaType(seasonNumber, episodeNumber) },
      });
      return NextResponse.json({ ok: true, source: "Rating:episode-only" });
    }

    const tmdbId = positiveInteger(url.searchParams.get("tmdbId"));
    if (!mediaType || !tmdbId) {
      return NextResponse.json({ error: "mediaType, tmdbId required" }, { status: 400 });
    }
    const type = canonicalType(mediaType);
    const result = await db.media.updateMany({
      where: { userId: user.id, type, tmdbId },
      data: { userRating: null, ratingStatus: null },
    });
    return NextResponse.json({ ok: true, updated: result.count, source: "Media" });
  } catch (error) {
    console.error("[ratings:DELETE]", error);
    return NextResponse.json({ error: "Failed to remove rating" }, { status: 500 });
  }
}
