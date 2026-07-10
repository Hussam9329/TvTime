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

// GET - list title ratings or independent episode ratings.
export async function GET(req: NextRequest) {
  try {
    const userId = parseUserId(req);
    if (!userId) return NextResponse.json({ error: "userId required" }, { status: 400 });

    const url = new URL(req.url);
    const mediaType = url.searchParams.get("mediaType");
    const showId = positiveInteger(url.searchParams.get("showId"));
    const seasonNumber = positiveInteger(url.searchParams.get("seasonNumber"));
    const episodeNumber = positiveInteger(url.searchParams.get("episodeNumber"));
    const user = await getOrCreateUser(userId);

    const where: Prisma.RatingWhereInput = { userId: user.id };
    if (mediaType === "episode") {
      if (!showId) return NextResponse.json({ error: "showId required for episode ratings" }, { status: 400 });
      where.tmdbId = showId;
      where.mediaType = seasonNumber && episodeNumber
        ? episodeRatingMediaType(seasonNumber, episodeNumber)
        : { startsWith: "episode:" };
    } else if (mediaType) {
      where.mediaType = mediaType;
    }

    const items = await db.rating.findMany({
      where,
      orderBy: { updatedAt: "desc" },
    });

    return NextResponse.json({
      items: items.map((item) => {
        const identity = parseEpisodeRatingMediaType(item.mediaType);
        return identity
          ? { ...item, showId: item.tmdbId, ...identity, scope: "episode" }
          : item;
      }),
    });
  } catch (error) {
    console.error("[ratings:GET]", error);
    return NextResponse.json({ error: "Failed to load ratings" }, { status: 500 });
  }
}

// POST - set a title rating or an independent episode rating.
export async function POST(req: NextRequest) {
  try {
    const userId = parseUserId(req);
    if (!userId) return NextResponse.json({ error: "userId required" }, { status: 400 });

    const body = await req.json();
    const user = await getOrCreateUser(userId);

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
          {
            error: "An episode can only be rated after it has aired.",
            code: "EPISODE_RATING_REQUIRES_RELEASE",
          },
          { status: 409 },
        );
      }
      if (!watchedEpisode) {
        return NextResponse.json(
          {
            error: "Mark this episode as watched before rating it.",
            code: "EPISODE_RATING_REQUIRES_WATCHED",
          },
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
        where: {
          userId_mediaType_tmdbId: {
            userId: user.id,
            mediaType: encodedMediaType,
            tmdbId: showId,
          },
        },
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

      return NextResponse.json({
        item: { ...item, showId, seasonNumber, episodeNumber, scope: "episode" },
      });
    }

    const mediaType = String(body.mediaType || "");
    const tmdbId = positiveInteger(body.tmdbId);
    if (!mediaType || !tmdbId || body.value == null) {
      return NextResponse.json({ error: "mediaType, tmdbId, value required" }, { status: 400 });
    }

    if (mediaType === "tv") {
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

    // Preserve the legacy 1-10 title-rating route for compatibility. The main
    // application stores movie/show ratings out of 100 on Media.userRating.
    const value = Math.max(1, Math.min(10, Number(body.value)));
    const item = await db.rating.upsert({
      where: {
        userId_mediaType_tmdbId: { userId: user.id, mediaType, tmdbId },
      },
      create: {
        userId: user.id,
        mediaType,
        tmdbId,
        title: body.title || "Unknown",
        posterPath: body.posterPath || null,
        value,
      },
      update: {
        value,
        ...(body.title ? { title: body.title } : {}),
        ...(body.posterPath !== undefined ? { posterPath: body.posterPath } : {}),
      },
    });
    return NextResponse.json({ item });
  } catch (error) {
    console.error("[ratings:POST]", error);
    return NextResponse.json({ error: "Failed to save rating" }, { status: 500 });
  }
}

// DELETE - remove a title rating or one independent episode rating.
export async function DELETE(req: NextRequest) {
  try {
    const userId = parseUserId(req);
    if (!userId) return NextResponse.json({ error: "userId required" }, { status: 400 });

    const url = new URL(req.url);
    const mediaType = url.searchParams.get("mediaType");
    const user = await getOrCreateUser(userId);

    if (mediaType === "episode") {
      const showId = positiveInteger(url.searchParams.get("showId") ?? url.searchParams.get("tmdbId"));
      const seasonNumber = positiveInteger(url.searchParams.get("seasonNumber"));
      const episodeNumber = positiveInteger(url.searchParams.get("episodeNumber"));
      if (!showId || !seasonNumber || !episodeNumber) {
        return NextResponse.json(
          { error: "showId, seasonNumber and episodeNumber required" },
          { status: 400 },
        );
      }
      await db.rating.deleteMany({
        where: {
          userId: user.id,
          tmdbId: showId,
          mediaType: episodeRatingMediaType(seasonNumber, episodeNumber),
        },
      });
      return NextResponse.json({ ok: true });
    }

    const tmdbId = positiveInteger(url.searchParams.get("tmdbId"));
    if (!mediaType || !tmdbId) {
      return NextResponse.json({ error: "mediaType, tmdbId required" }, { status: 400 });
    }

    await db.rating.deleteMany({ where: { userId: user.id, mediaType, tmdbId } });
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("[ratings:DELETE]", error);
    return NextResponse.json({ error: "Failed to remove rating" }, { status: 500 });
  }
}
