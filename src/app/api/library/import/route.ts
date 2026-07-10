import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getOrCreateUser, parseUserId } from "@/lib/user";
import { encodeJsonArray } from "@/lib/media-normalize";
import { ensureCanonicalMedia, updateCanonicalMediaState } from "@/lib/media-repository";
import { canonicalStateFromLegacy, compatibilityFieldsForState, mergeCanonicalStates, type CanonicalMediaState } from "@/lib/media-state";

export async function POST(req: NextRequest) {
  try {
    const user = await getOrCreateUser(parseUserId(req));
    const body = await req.json();
    const library = body?.library;
    if (!library || typeof library !== "object") {
      return NextResponse.json({ error: "Invalid import format: 'library' object required" }, { status: 400 });
    }

    const imported = { media: 0, watchedEpisodes: 0, watchlist: 0, watchedMovies: 0, following: 0, ratings: 0 };

    const mergeMedia = async (item: any, forcedState?: CanonicalMediaState) => {
      if (!item?.title || !item?.type) return null;
      const requestedState = forcedState ?? canonicalStateFromLegacy(item);
      const media = await ensureCanonicalMedia({
        userId: user.id,
        tmdbId: item.tmdbId == null ? null : Number(item.tmdbId),
        title: String(item.title),
        type: String(item.type),
        poster: item.poster ?? item.posterPath ?? null,
        year: item.year ?? (item.releaseDate ? String(item.releaseDate).slice(0, 4) : null),
        overview: item.overview || null,
        rating: item.rating ?? item.voteAverage ?? null,
        runtime: item.runtime == null ? null : Number(item.runtime),
        genres: item.genres ?? item.genresJson,
        seasons: item.seasons == null ? null : Number(item.seasons),
        episodes: item.episodes == null ? null : Number(item.episodes),
        isAnime: Boolean(item.isAnime),
        initialState: requestedState,
      });

      const finalState = mergeCanonicalStates(canonicalStateFromLegacy(media), requestedState);
      return updateCanonicalMediaState(media, finalState, {
        completedAt: item.watchedAt || null,
        data: {
          originalTitle: item.originalTitle || media.originalTitle,
          duration: item.duration || media.duration,
          author: item.author || media.author,
          pages: item.pages == null ? media.pages : Number(item.pages),
          tagsJson: item.tags === undefined && item.tagsJson === undefined
            ? media.tagsJson
            : encodeJsonArray(item.tags ?? item.tagsJson),
          notes: item.notes || media.notes,
          userRating: item.userRating == null ? media.userRating : Math.max(0, Math.min(100, Number(item.userRating))),
          rewatch: item.rewatch == null ? media.rewatch : Boolean(item.rewatch),
          ratingStatus: item.ratingStatus || media.ratingStatus,
        },
      });
    };

    if (Array.isArray(library.media)) {
      for (const item of library.media) {
        if (await mergeMedia(item)) imported.media++;
      }
    }

    if (Array.isArray(library.watchedEpisodes)) {
      for (const item of library.watchedEpisodes) {
        if (!item.showId || item.seasonNumber == null || item.episodeNumber == null) continue;
        await db.watchedEpisode.upsert({
          where: {
            userId_showId_seasonNumber_episodeNumber: {
              userId: user.id,
              showId: Number(item.showId),
              seasonNumber: Number(item.seasonNumber),
              episodeNumber: Number(item.episodeNumber),
            },
          },
          create: {
            userId: user.id,
            showId: Number(item.showId),
            seasonNumber: Number(item.seasonNumber),
            episodeNumber: Number(item.episodeNumber),
            episodeName: item.episodeName || null,
            runtime: item.runtime == null ? null : Number(item.runtime),
            watchedAt: item.watchedAt ? new Date(item.watchedAt) : new Date(),
          },
          update: {
            episodeName: item.episodeName || undefined,
            runtime: item.runtime == null ? undefined : Number(item.runtime),
          },
        });
        imported.watchedEpisodes++;
      }
    }

    if (Array.isArray(library.watchlist)) {
      for (const item of library.watchlist) {
        if (!item.mediaType || !item.tmdbId || !item.title) continue;
        await mergeMedia({ ...item, type: item.mediaType === "tv" ? "series" : "movie" }, "planned");
        imported.watchlist++;
      }
    }

    if (Array.isArray(library.watchedMovies)) {
      for (const item of library.watchedMovies) {
        if (!item.tmdbId || !item.title) continue;
        await mergeMedia({ ...item, type: "movie" }, "completed");
        imported.watchedMovies++;
      }
    }

    if (Array.isArray(library.following)) {
      for (const item of library.following) {
        if (!item.tmdbId || !item.title) continue;
        await mergeMedia({ ...item, type: "series" }, "planned");
        imported.following++;
      }
    }

    if (Array.isArray(library.ratings)) {
      for (const item of library.ratings) {
        if (!item.mediaType || !item.tmdbId || item.value == null) continue;
        const media = await mergeMedia({
          ...item,
          type: item.mediaType === "tv" ? "series" : "movie",
          userRating: Math.max(0, Math.min(100, Number(item.value) <= 10 ? Number(item.value) * 10 : Number(item.value))),
        }, "none");
        if (media) imported.ratings++;
      }
    }

    // Legacy backups can contain episode facts plus only a Following row.
    // Promote planned shows with progress and create a canonical placeholder
    // for orphan episode facts, without overriding an explicitly untracked row.
    const episodeGroups = await db.watchedEpisode.groupBy({
      by: ["showId"],
      where: { userId: user.id, seasonNumber: { gt: 0 } },
      _count: { _all: true },
      _max: { watchedAt: true },
    });
    for (const group of episodeGroups) {
      let media = await db.media.findFirst({
        where: { userId: user.id, type: "series", tmdbId: group.showId },
      });
      if (!media) {
        media = await ensureCanonicalMedia({
          userId: user.id,
          tmdbId: group.showId,
          title: `TV ${group.showId}`,
          type: "series",
          initialState: "watching",
        });
        continue;
      }
      if (canonicalStateFromLegacy(media) !== "planned") continue;
      const knownTotal = Number(media.episodes || 0);
      const nextState = knownTotal > 0 && group._count._all >= knownTotal ? "up_to_date" : "watching";
      await db.media.update({
        where: { id: media.id },
        data: compatibilityFieldsForState(nextState, "series", { completedAt: group._max.watchedAt }),
      });
    }

    return NextResponse.json({ ok: true, imported, sourceOfTruth: "Media.libraryState" });
  } catch (error) {
    console.error("[library:import]", error);
    return NextResponse.json({ error: "Failed to import library" }, { status: 500 });
  }
}
