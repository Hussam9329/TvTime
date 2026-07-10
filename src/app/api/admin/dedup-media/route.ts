import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getOrCreateUser, parseUserId } from "@/lib/user";

/**
 * TVM Fix: Dedup duplicate Media rows by (userId + type + tmdbId).
 *
 * Before adding a unique constraint, we must merge existing duplicates:
 * 1. Find all groups of (userId, type, tmdbId) with more than 1 row
 * 2. For each group, pick the "best" row (most complete data)
 * 3. Move watchedEpisode references to the best row's tmdbId (same tmdbId, no change needed)
 * 4. Move Rating references to the best row
 * 5. Delete the inferior duplicates
 *
 * "Best" = most data: watched=true wins, highest userRating wins, non-null status wins,
 * most recent watchedAt/updatedAt wins.
 *
 * TVM-40: Always enforces admin secret.
 */
import { enforceAdminSecret } from "@/lib/admin-guard";

export async function GET(req: NextRequest) {
  const guard = enforceAdminSecret(req);
  if (guard) return guard;

  try {
    // Step 1: Find all groups with duplicates
    // We can't use groupBy on tmdbId easily with Prisma for NULL tmdbId handling,
    // so fetch all media with non-null tmdbId and group in JS.
    const allMedia = await db.media.findMany({
      where: { tmdbId: { not: null } },
      select: {
        id: true,
        userId: true,
        tmdbId: true,
        type: true,
        title: true,
        watched: true,
        status: true,
        userRating: true,
        watchedAt: true,
        updatedAt: true,
        addedAt: true,
        poster: true,
        overview: true,
        year: true,
        rating: true,
        runtime: true,
        seasons: true,
        episodes: true,
        genres: true,
        isAnime: true,
        notes: true,
        rewatch: true,
        ratingStatus: true,
      },
      orderBy: { updatedAt: "desc" },
    });

    // Group by userId + type + tmdbId
    const groups = new Map<string, typeof allMedia>();
    for (const item of allMedia) {
      const key = `${item.userId}|${item.type}|${item.tmdbId}`;
      const group = groups.get(key) ?? [];
      group.push(item);
      groups.set(key, group);
    }

    // Find groups with duplicates
    const duplicateGroups: { key: string; items: typeof allMedia }[] = [];
    for (const [key, items] of groups) {
      if (items.length > 1) {
        duplicateGroups.push({ key, items });
      }
    }

    if (duplicateGroups.length === 0) {
      return NextResponse.json({
        ok: true,
        duplicateGroups: 0,
        merged: 0,
        deleted: 0,
        message: "No duplicate Media rows found. Database is clean.",
      });
    }

    // Step 2: For each group, pick the best row and delete the rest
    let merged = 0;
    let deleted = 0;
    const dryRun = req.nextUrl.searchParams.get("apply") !== "true";

    for (const group of duplicateGroups) {
      const items = group.items;

      // Pick the best row: watched=true wins, highest rating wins, most recent wins
      let best = items[0];
      for (const item of items) {
        if (item.watched && !best.watched) best = item;
        if (item.userRating != null && (best.userRating == null || item.userRating > best.userRating)) best = item;
        if (item.status && !best.status) best = item;
        if (item.watchedAt && !best.watchedAt) best = item;
        if (item.updatedAt > best.updatedAt) best = item;
      }

      // Merge data from all duplicates into the best row
      const mergedData: any = {};
      for (const item of items) {
        if (item.id === best.id) continue;
        if (item.watched && !best.watched) mergedData.watched = true;
        if (item.userRating != null && (best.userRating == null || item.userRating > best.userRating)) mergedData.userRating = item.userRating;
        if (item.status && !best.status) mergedData.status = item.status;
        if (item.watchedAt && !best.watchedAt) mergedData.watchedAt = item.watchedAt;
        if (item.poster && !best.poster) mergedData.poster = item.poster;
        if (item.overview && !best.overview) mergedData.overview = item.overview;
        if (item.year && !best.year) mergedData.year = item.year;
        if (item.rating && !best.rating) mergedData.rating = item.rating;
        if (item.runtime != null && best.runtime == null) mergedData.runtime = item.runtime;
        if (item.seasons != null && best.seasons == null) mergedData.seasons = item.seasons;
        if (item.episodes != null && best.episodes == null) mergedData.episodes = item.episodes;
        if (item.genres.length > 0 && best.genres.length === 0) mergedData.genres = item.genres;
        if (item.isAnime && !best.isAnime) mergedData.isAnime = true;
      }

      // IDs to delete (all except best)
      const idsToDelete = items.filter((i) => i.id !== best.id).map((i) => i.id);

      if (!dryRun) {
        // Update best row with merged data
        if (Object.keys(mergedData).length > 0) {
          await db.media.update({ where: { id: best.id }, data: mergedData });
        }

        // Move episode ratings (Rating table) from deleted rows to best row
        // Ratings are keyed by userId + mediaType + tmdbId, so they don't need
        // row-level migration — they reference tmdbId, not media.id.

        // Delete duplicate rows
        await db.media.deleteMany({ where: { id: { in: idsToDelete } } });
      }

      merged++;
      deleted += idsToDelete.length;
    }

    return NextResponse.json({
      ok: true,
      dryRun,
      duplicateGroups: duplicateGroups.length,
      merged,
      deleted,
      message: dryRun
        ? `DRY RUN: Found ${duplicateGroups.length} duplicate groups (${deleted} rows would be deleted). Add ?apply=true to execute.`
        : `Merged ${merged} duplicate groups, deleted ${deleted} redundant rows.`,
    });
  } catch (error: any) {
    console.error("[admin:dedup-media]", error);
    return NextResponse.json({ error: error?.message || "Failed" }, { status: 500 });
  }
}
