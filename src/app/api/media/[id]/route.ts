import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getOrCreateUser, parseUserId } from "@/lib/user";
import { normalizeMedia } from "@/lib/media-normalize";
import { tmdb } from "@/lib/tmdb";

function isEndedTvStatus(status?: string | null) {
  const normalized = String(status || "").trim().toLowerCase();
  return normalized === "ended" || normalized === "canceled" || normalized === "cancelled";
}

async function getTvRatingEligibility(userId: string, tmdbId: number | null | undefined, fallbackTotalEpisodes?: number | null) {
  if (!tmdbId) return { allowed: false, reason: "missing-tmdb-id", totalEpisodes: 0, watchedEpisodes: 0 };

  try {
    const detail: any = await tmdb.tvDetail(Number(tmdbId));
    if (!isEndedTvStatus(detail?.status)) {
      return { allowed: false, reason: "show-not-ended", totalEpisodes: detail?.number_of_episodes ?? fallbackTotalEpisodes ?? 0, watchedEpisodes: 0 };
    }

    const totalEpisodes = Number(detail?.number_of_episodes ?? fallbackTotalEpisodes ?? 0);
    const watchedEpisodes = await db.watchedEpisode.count({ where: { userId, showId: Number(tmdbId) } });
    if (totalEpisodes > 0 && watchedEpisodes < totalEpisodes) {
      return { allowed: false, reason: "not-fully-watched", totalEpisodes, watchedEpisodes };
    }

    return { allowed: true, reason: "ok", totalEpisodes, watchedEpisodes };
  } catch (error) {
    console.warn("[media:update] Unable to verify TV rating eligibility", tmdbId, error);
    return { allowed: false, reason: "tmdb-unverified", totalEpisodes: fallbackTotalEpisodes ?? 0, watchedEpisodes: 0 };
  }
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const user = await getOrCreateUser(parseUserId(req));
    const body = await req.json();

    const data: any = {};
    if (body.userRating !== undefined) data.userRating = body.userRating === null ? null : Math.max(0, Math.min(100, Number(body.userRating)));
    if (body.watched !== undefined) data.watched = Boolean(body.watched);
    if (body.watchedAt !== undefined) data.watchedAt = body.watchedAt ? new Date(body.watchedAt) : null;
    if (body.isAnime !== undefined) data.isAnime = Boolean(body.isAnime);
    if (body.status !== undefined) data.status = body.status;
    if (body.ratingStatus !== undefined) data.ratingStatus = body.ratingStatus;
    if (body.notes !== undefined) data.notes = body.notes || null;
    if (body.rewatch !== undefined) data.rewatch = Boolean(body.rewatch);

    const existing = await db.media.findFirst({ where: { id, userId: user.id } });
    if (!existing) return NextResponse.json({ error: "Media item not found" }, { status: 404 });

    if (existing.type === "series" && data.userRating != null) {
      const eligibility = await getTvRatingEligibility(user.id, existing.tmdbId, existing.episodes);
      if (!eligibility.allowed) {
        const isNotFullyWatched = eligibility.reason === "not-fully-watched";
        return NextResponse.json(
          {
            error: isNotFullyWatched
              ? "TV series can only be rated after every episode has been watched."
              : "TV series can only be rated after the whole show has ended on TMDB.",
            code: isNotFullyWatched ? "TV_RATING_REQUIRES_ALL_EPISODES" : "TV_RATING_LOCKED_UNTIL_ENDED",
            totalEpisodes: eligibility.totalEpisodes,
            watchedEpisodes: eligibility.watchedEpisodes,
          },
          { status: 409 }
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
