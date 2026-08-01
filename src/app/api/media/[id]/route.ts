import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getOrCreateUser } from "@/lib/user";
import { resolveUserId } from "@/lib/auth";
import { normalizeMedia } from "@/lib/media-normalize";
import { normalizeTvTrackingState } from "@/lib/tv-status-engine";
import { saveTvCompletionRating, tvRatingEligibilityError } from "@/lib/tv-rating-eligibility";
import { issueWatchUndoToken, mediaWatchSnapshot } from "@/lib/watch-undo-token";

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const user = await getOrCreateUser(await resolveUserId(req));
    const body = await req.json();
    const existing = await db.media.findFirst({ where: { id, userId: user.id } });
    if (!existing) return NextResponse.json({ error: "Media item not found" }, { status: 404 });

    if (body.isAnime !== undefined || body.isArabic !== undefined) {
      return NextResponse.json(
        {
          error: "Media world classification is automatic and cannot be changed manually.",
          code: "MEDIA_CLASSIFICATION_IMMUTABLE",
        },
        { status: 400 },
      );
    }

    const hasRatingMutation = body.userRating !== undefined;
    const hasWatchMutation = body.watched !== undefined || body.watchedAt !== undefined || body.status !== undefined;
    const createsMovieWatchUndo = existing.type === "movie" && Boolean(
      body.watched !== undefined
        || body.watchedAt !== undefined
        || body.rewatchIncrement === true
        || body.status === "watched"
        || (body.status !== undefined && (existing.watched || existing.status === "watched")),
    );
    if (existing.type === "series" && hasRatingMutation && hasWatchMutation) {
      return NextResponse.json(
        {
          error: "TV rating and watch state must be updated in separate requests.",
          code: "RATING_WATCH_STATE_MUST_BE_SEPARATE",
        },
        { status: 400 },
      );
    }

    const data: any = {};
    if (body.userRating !== undefined) {
      const numericRating = body.userRating === null ? null : body.userRating;
      if (numericRating !== null && (!Number.isInteger(numericRating) || numericRating < 0 || numericRating > 100)) {
        return NextResponse.json(
          { error: "User rating must be a whole number from 0 to 100.", code: "INVALID_USER_RATING" },
          { status: 400 },
        );
      }
      data.userRating = numericRating;
    }
    if (body.tmdbId !== undefined) data.tmdbId = body.tmdbId === null ? null : Number(body.tmdbId);
    if (body.watched !== undefined) data.watched = Boolean(body.watched);
    if (body.watchedAt !== undefined) data.watchedAt = body.watchedAt ? new Date(body.watchedAt) : null;
    if (body.status !== undefined) data.status = body.status;
    if (body.ratingStatus !== undefined) data.ratingStatus = body.ratingStatus;
    if (body.notes !== undefined) data.notes = body.notes || null;
    if (body.rewatch !== undefined) data.rewatch = Boolean(body.rewatch);
    if (body.poster !== undefined) data.poster = body.poster || null;
    if (body.overview !== undefined) data.overview = body.overview || null;

    if (body.rewatchIncrement === true) {
      if (existing.type !== "movie" || !existing.watched) {
        return NextResponse.json({ error: "Only an already watched movie can be watched again" }, { status: 409 });
      }
      if (existing.userRating == null) {
        return NextResponse.json(
          {
            error: "Rate this movie before recording a rewatch.",
            code: "MOVIE_WATCHED_REQUIRES_RATING",
          },
          { status: 409 },
        );
      }
      data.rewatch = true;
      data.rewatchCount = { increment: 1 };
      data.watchedAt = new Date();
      data.status = "watched";
    }

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
    if (existing.type !== "series" && body.watched === false) {
      if (body.status === undefined && existing.status === "watched") data.status = null;
      if (body.watchedAt === undefined) data.watchedAt = null;
    }
    if (existing.type !== "series" && body.status === "watched") {
      data.watched = true;
      if (body.watchedAt === undefined) data.watchedAt = new Date();
    }

    if (existing.type === "movie") {
      const finalWatched = data.watched === undefined ? existing.watched : Boolean(data.watched);
      const finalStatus = data.status === undefined ? existing.status : data.status;
      const finalRating = data.userRating === undefined ? existing.userRating : data.userRating;
      if ((finalWatched || finalStatus === "watched") && finalRating == null) {
        return NextResponse.json(
          {
            error: "A watched movie must include your rating out of 100.",
            code: "MOVIE_WATCHED_REQUIRES_RATING",
          },
          { status: 409 },
        );
      }
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

      if (requestedState === "planned") data.isFollowing = false;

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
      const completion = await saveTvCompletionRating({
        userId: user.id,
        mediaId: existing.id,
        rating: data.userRating,
      });
      if (!completion.item) {
        const failure = tvRatingEligibilityError(completion.eligibility);
        return NextResponse.json(
          {
            error: failure.message,
            code: failure.code,
            totalEpisodes: completion.eligibility.totalEpisodes,
            watchedEpisodes: completion.eligibility.watchedEpisodes,
            tmdbStatus: completion.eligibility.tmdbStatus,
          },
          { status: 409 },
        );
      }
      return NextResponse.json({ item: normalizeMedia(completion.item) });
    } else if (existing.type === "series" && body.userRating === null) {
      // A series cannot remain Finished after its required personal rating is
      // removed. Keep all episode history and its last watched timestamp.
      if (normalizeTvTrackingState(existing.status) === "finished" || existing.watched) {
        data.status = "uptodate";
        data.watched = false;
      }
    }

    if (existing.type === "series") {
      const finalWatched = data.watched === undefined ? existing.watched : Boolean(data.watched);
      const finalStatus = data.status === undefined ? normalizeTvTrackingState(existing.status) : normalizeTvTrackingState(data.status);
      const finalRating = data.userRating === undefined ? existing.userRating : data.userRating;
      if ((finalWatched || finalStatus === "finished") && finalRating == null) {
        return NextResponse.json(
          {
            error: "A finished TV series must include your rating out of 100.",
            code: "TV_FINISHED_REQUIRES_RATING",
          },
          { status: 409 },
        );
      }
    }

    const item = await db.media.update({ where: { id }, data });
    const undoToken = createsMovieWatchUndo
      ? await issueWatchUndoToken({
          kind: "movie",
          userId: user.id,
          mediaId: existing.id,
          mediaBefore: mediaWatchSnapshot(existing),
        })
      : undefined;
    return NextResponse.json({ item: normalizeMedia(item), undoToken });
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
    const user = await getOrCreateUser(await resolveUserId(req));
    const result = await db.media.deleteMany({ where: { id, userId: user.id } });
    if (result.count === 0) return NextResponse.json({ error: "Media item not found" }, { status: 404 });
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("[media:delete]", error);
    return NextResponse.json({ error: "Failed to delete media item" }, { status: 500 });
  }
}
