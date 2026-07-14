import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getOrCreateUser, parseUserId } from "@/lib/user";
import { normalizeMedia } from "@/lib/media-normalize";
import { normalizeTvTrackingState } from "@/lib/tv-status-engine";
import { getTvRatingEligibility, tvRatingEligibilityError } from "@/lib/tv-rating-eligibility";
import { validateBody } from "@/lib/validate";
import { ApiError, handleError } from "@/lib/api-error";
import { updateMediaSchema } from "@/lib/schemas/media";

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const user = await getOrCreateUser(parseUserId(req));
    const body = await req.json();

    // ── Validate input via zod ──────────────────────────────────────
    const result = validateBody(updateMediaSchema, body);
    if (result instanceof NextResponse) return result;

    const hasRatingMutation = result.userRating !== undefined;
    const hasWatchMutation =
      result.watched !== undefined || result.watchedAt !== undefined || result.status !== undefined;
    if (hasRatingMutation && hasWatchMutation) {
      throw new ApiError(
        "RATING_WATCH_STATE_MUST_BE_SEPARATE",
        "Rating and watch state must be updated in separate requests."
      );
    }

    const data: Record<string, unknown> = {};
    if (result.userRating !== undefined) {
      data.userRating = result.userRating === null ? null : Math.max(0, Math.min(100, result.userRating));
    }
    if (result.tmdbId !== undefined) data.tmdbId = result.tmdbId === null ? null : Number(result.tmdbId);
    if (result.watched !== undefined) data.watched = Boolean(result.watched);
    if (result.watchedAt !== undefined) data.watchedAt = result.watchedAt ? new Date(result.watchedAt) : null;
    if (result.isAnime !== undefined) {
      data.isAnime = Boolean(result.isAnime);
      if (data.isAnime) data.isArabic = false;
    }
    if (result.isArabic !== undefined) {
      data.isArabic = Boolean(result.isArabic);
      if (data.isArabic) data.isAnime = false;
    }
    if (result.status !== undefined) data.status = result.status;
    if (result.ratingStatus !== undefined) data.ratingStatus = result.ratingStatus;
    if (result.notes !== undefined) data.notes = result.notes || null;
    if (result.rewatch !== undefined) data.rewatch = Boolean(result.rewatch);
    if (result.poster !== undefined) data.poster = result.poster || null;
    if (result.overview !== undefined) data.overview = result.overview || null;

    const existing = await db.media.findFirst({ where: { id, userId: user.id } });
    if (!existing) {
      throw new ApiError("NOT_FOUND", "Media item not found");
    }

    if (existing.type !== "series" && result.status === "planned" && existing.watched) {
      throw new ApiError(
        "WATCHLIST_REQUIRES_UNWATCHED",
        "A watched title cannot also be placed in Watchlist."
      );
    }

    if (existing.type !== "series" && result.watched === true) {
      data.status = "watched";
      if (result.watchedAt === undefined) data.watchedAt = new Date();
    }

    if (existing.type === "series" && hasWatchMutation) {
      const requestedState = result.status === undefined ? undefined : normalizeTvTrackingState(result.status);
      const existingState = normalizeTvTrackingState(existing.status);
      const progressStates = new Set(["watching", "uptodate", "finished"]);
      const requestsDirectProgress = Boolean(
        result.watched === true ||
          (result.watchedAt !== undefined && result.watchedAt !== null) ||
          (requestedState && progressStates.has(requestedState))
      );

      if (requestsDirectProgress) {
        throw new ApiError(
          "TV_STATE_REQUIRES_EPISODE_ENGINE",
          "TV progress must be changed by marking released episodes watched or unwatched."
        );
      }

      const watchedEpisodeCount = existing.tmdbId
        ? await db.watchedEpisode.count({ where: { userId: user.id, showId: existing.tmdbId } })
        : 0;
      const hasExistingProgress = Boolean(
        existing.watched ||
          (existingState && progressStates.has(existingState)) ||
          watchedEpisodeCount > 0
      );

      if (hasExistingProgress) {
        throw new ApiError(
          "TV_PROGRESS_MUST_BE_CHANGED_BY_EPISODES",
          "This show already has episode progress. Change its watched episodes instead of overwriting the series state.",
          { watchedEpisodeCount }
        );
      }

      if (requestedState === "planned") data.isFollowing = false;

      if (result.status !== undefined && result.status !== null && requestedState !== "planned" && requestedState !== "not_started") {
        throw new ApiError(
          "INVALID_TV_TRACKING_STATE",
          "Unsupported TV tracking state."
        );
      }
    }

    if (existing.type === "series" && data.userRating != null) {
      const eligibility = await getTvRatingEligibility(user.id, existing.tmdbId);
      if (!eligibility.allowed) {
        const failure = tvRatingEligibilityError(eligibility);
        throw new ApiError(
          "TV_PROGRESS_MUST_BE_CHANGED_BY_EPISODES" as any,
          failure.message,
          {
            totalEpisodes: eligibility.totalEpisodes,
            watchedEpisodes: eligibility.watchedEpisodes,
            tmdbStatus: eligibility.tmdbStatus,
          }
        );
      }
    }

    const item = await db.media.update({ where: { id }, data });
    return NextResponse.json({ item: normalizeMedia(item) });
  } catch (error) {
    return handleError(error);
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
    if (result.count === 0) {
      throw new ApiError("NOT_FOUND", "Media item not found");
    }
    return NextResponse.json({ ok: true });
  } catch (error) {
    return handleError(error);
  }
}
