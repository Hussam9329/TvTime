import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getOrCreateUser, parseUserId } from "@/lib/user";
import { normalizeMedia } from "@/lib/media-normalize";
import { normalizeTvTrackingState } from "@/lib/tv-status-engine";
import { getTvRatingEligibility, tvRatingEligibilityError } from "@/lib/tv-rating-eligibility";

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const user = await getOrCreateUser(parseUserId(req));
    const body = await req.json();

    const hasRatingMutation = body.userRating !== undefined;
    const hasWatchMutation = body.watched !== undefined || body.watchedAt !== undefined || body.status !== undefined;
    if (hasRatingMutation && hasWatchMutation) {
      return NextResponse.json(
        {
          error: "Rating and watch state must be updated in separate requests.",
          code: "RATING_WATCH_STATE_MUST_BE_SEPARATE",
        },
        { status: 400 },
      );
    }

    const data: any = {};
    if (body.userRating !== undefined) {
      data.userRating = body.userRating === null
        ? null
        : Math.max(0, Math.min(100, Number(body.userRating)));
    }
    if (body.tmdbId !== undefined) data.tmdbId = body.tmdbId === null ? null : Number(body.tmdbId);
    if (body.watched !== undefined) data.watched = Boolean(body.watched);
    if (body.watchedAt !== undefined) data.watchedAt = body.watchedAt ? new Date(body.watchedAt) : null;
    if (body.isAnime !== undefined) data.isAnime = Boolean(body.isAnime);
    if (body.status !== undefined) data.status = body.status;
    if (body.ratingStatus !== undefined) data.ratingStatus = body.ratingStatus;
    if (body.notes !== undefined) data.notes = body.notes || null;
    if (body.rewatch !== undefined) data.rewatch = Boolean(body.rewatch);
    if (body.poster !== undefined) data.poster = body.poster || null;
    if (body.overview !== undefined) data.overview = body.overview || null;

    const existing = await db.media.findFirst({ where: { id, userId: user.id } });
    if (!existing) return NextResponse.json({ error: "Media item not found" }, { status: 404 });

    if (existing.type !== "series" && body.status === "planned" && existing.watched) {
      return NextResponse.json(
        {
          error: "A watched title cannot also be placed in Watchlist.",
          code: "WATCHLIST_REQUIRES_UNWATCHED",
        },
        { status: 409 },
      );
    }

    if (existing.type !== "series" && body.watched === true) {
      data.status = "watched";
      if (body.watchedAt === undefined) data.watchedAt = new Date();
    }

    if (existing.type === "series" && hasWatchMutation) {
      const requestedState = body.status === undefined
        ? undefined
        : normalizeTvTrackingState(body.status);
      const existingState = normalizeTvTrackingState(existing.status);
      const progressStates = new Set(["watching", "uptodate", "finished"]);
      const requestsDirectProgress = Boolean(
        body.watched === true
          || (body.watchedAt !== undefined && body.watchedAt !== null)
          || (requestedState && progressStates.has(requestedState)),
      );

      if (requestsDirectProgress) {
        return NextResponse.json(
          {
            error: "TV progress must be changed by marking released episodes watched or unwatched.",
            code: "TV_STATE_REQUIRES_EPISODE_ENGINE",
          },
          { status: 409 },
        );
      }

      const watchedEpisodeCount = existing.tmdbId
        ? await db.watchedEpisode.count({ where: { userId: user.id, showId: existing.tmdbId } })
        : 0;
      const hasExistingProgress = Boolean(
        existing.watched
          || (existingState && progressStates.has(existingState))
          || watchedEpisodeCount > 0,
      );

      if (hasExistingProgress) {
        return NextResponse.json(
          {
            error: "This show already has episode progress. Change its watched episodes instead of overwriting the series state.",
            code: "TV_PROGRESS_MUST_BE_CHANGED_BY_EPISODES",
            watchedEpisodeCount,
          },
          { status: 409 },
        );
      }

      if (body.status !== undefined && body.status !== null && requestedState !== "planned" && requestedState !== "not_started") {
        return NextResponse.json(
          {
            error: "Unsupported TV tracking state.",
            code: "INVALID_TV_TRACKING_STATE",
          },
          { status: 400 },
        );
      }
    }

    if (existing.type === "series" && data.userRating != null) {
      const eligibility = await getTvRatingEligibility(user.id, existing.tmdbId);
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

    const item = await db.media.update({ where: { id }, data });
    return NextResponse.json({ item: normalizeMedia(item) });
  } catch (error) {
    console.error("[media:update]", error);
    return NextResponse.json({ error: "Failed to update media item" }, { status: 500 });
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const user = await getOrCreateUser(parseUserId(req));
    const result = await db.media.deleteMany({ where: { id, userId: user.id } });
    if (result.count === 0) return NextResponse.json({ error: "Media item not found" }, { status: 404 });
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("[media:delete]", error);
    return NextResponse.json({ error: "Failed to delete media item" }, { status: 500 });
  }
}
