import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { enforceAdminSecret } from "@/lib/admin-guard";

const TMDB_API_KEY = process.env.TMDB_API_KEY?.trim();
const TMDB_BASE_URL = "https://api.themoviedb.org/3";

/**
 * Backfill tmdbId for Media rows that have NULL/0 tmdbId.
 * Searches TMDB by title + year, picks the best match, and updates the row.
 *
 * TVM-40: Always enforces admin secret.
 *
 * Query params:
 *   ?apply=true  — actually update (default: dry-run)
 *   ?limit=N     — max items to process (default: 500)
 *   ?type=movie  — filter by type (movie/series, default: movie)
 */

async function searchTmdb(title: string, year: string | null): Promise<{ tmdbId: number; poster: string | null; overview: string | null; voteAverage: number | null } | null> {
  if (!TMDB_API_KEY) throw new Error("TMDB_API_KEY is not configured");
  try {
    const params = new URLSearchParams({
      api_key: TMDB_API_KEY,
      language: "en-US",
      query: title,
      page: "1",
      include_adult: "false",
    });
    if (year) params.set("year", year);

    const url = `${TMDB_BASE_URL}/search/movie?${params}`;
    const res = await fetch(url);
    if (!res.ok) return null;
    const data = await res.json();
    const results = data.results || [];
    if (results.length === 0) return null;

    // Pick the best match: prefer exact title match + year match
    const titleLower = title.toLowerCase().trim();
    let best = results[0];
    let bestScore = 0;

    for (const r of results) {
      const rTitle = (r.title || r.original_title || "").toLowerCase().trim();
      let score = 0;
      if (rTitle === titleLower) score += 100;
      else if (rTitle.includes(titleLower) || titleLower.includes(rTitle)) score += 50;
      if (year && r.release_date && r.release_date.startsWith(year)) score += 30;
      if (r.vote_count > 100) score += 10;
      if (r.poster_path) score += 5;
      if (score > bestScore) {
        bestScore = score;
        best = r;
      }
    }

    // Require at least some similarity
    if (bestScore < 50) return null;

    return {
      tmdbId: best.id,
      poster: best.poster_path ? `https://image.tmdb.org/t/p/w500${best.poster_path}` : null,
      overview: best.overview || null,
      voteAverage: best.vote_average || null,
    };
  } catch {
    return null;
  }
}

export async function GET(req: NextRequest) {
  const guard = enforceAdminSecret(req);
  if (guard) return guard;

  try {
    const dryRun = req.nextUrl.searchParams.get("apply") !== "true";
    const limit = Math.min(Math.max(Number(req.nextUrl.searchParams.get("limit")) || 500, 1), 3000);
    const type = req.nextUrl.searchParams.get("type") || "movie";

    // Find all media items of the specified type without a valid tmdbId
    const items = await db.media.findMany({
      where: {
        type,
        OR: [{ tmdbId: null }, { tmdbId: 0 }],
      },
      select: { id: true, title: true, year: true, poster: true, overview: true, rating: true },
      take: limit,
      orderBy: { title: "asc" },
    });

    let updated = 0;
    let notFound = 0;
    let failed = 0;
    const sample: { title: string; year: string | null; tmdbId: number | null; status: string }[] = [];

    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      const year = item.year || null;

      const result = await searchTmdb(item.title, year);

      if (result) {
        if (!dryRun) {
          const updateData: any = { tmdbId: result.tmdbId };
          if (result.poster && !item.poster) updateData.poster = result.poster;
          if (result.overview && !item.overview) updateData.overview = result.overview;
          if (result.voteAverage != null && !item.rating) updateData.rating = String(result.voteAverage);
          await db.media.update({ where: { id: item.id }, data: updateData });
        }
        updated++;
        if (sample.length < 10) {
          sample.push({ title: item.title, year, tmdbId: result.tmdbId, status: "found" });
        }
      } else {
        notFound++;
        if (sample.length < 15) {
          sample.push({ title: item.title, year, tmdbId: null, status: "not found" });
        }
      }

      // Rate limit: TMDB allows ~40 requests per 10 seconds
      if (i > 0 && i % 35 === 0) {
        await new Promise((r) => setTimeout(r, 1000));
      }
      if ((i + 1) % 100 === 0) {
        console.log(`[backfill-tmdb-ids] Progress: ${i + 1}/${items.length} (found=${updated}, notFound=${notFound})`);
      }
    }

    return NextResponse.json({
      ok: true,
      dryRun,
      type,
      totalScanned: items.length,
      updated,
      notFound,
      failed,
      sample,
      message: dryRun
        ? `DRY RUN: Found TMDB IDs for ${updated}/${items.length} movies. Add ?apply=true to execute.`
        : `Updated ${updated}/${items.length} movies with TMDB IDs. ${notFound} not found on TMDB.`,
    });
  } catch (error: any) {
    console.error("[admin:backfill-tmdb-ids]", error);
    return NextResponse.json({ error: error?.message || "Failed" }, { status: 500 });
  }
}
