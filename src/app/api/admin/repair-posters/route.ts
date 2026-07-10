import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

// This endpoint repairs already-corrupted poster rows by fetching fresh
// poster URLs from TMDB and updating the DB. It's idempotent and safe to
// call multiple times. Pass ?secret=<ADMIN_REPAIR_SECRET> for basic protection.
//
// Set ADMIN_REPAIR_SECRET in your Vercel env vars to enable protection.

const TMDB_API_KEY = process.env.TMDB_API_KEY || "8265bd1679663a7ea12ac168da84d2e8";
const TMDB_BASE_URL = "https://api.themoviedb.org/3";

async function tmdbMovie(tmdbId: number) {
  const url = new URL(`${TMDB_BASE_URL}/movie/${tmdbId}`);
  url.searchParams.set("api_key", TMDB_API_KEY);
  url.searchParams.set("language", "en-US");
  const res = await fetch(url);
  if (!res.ok) throw new Error(`TMDB ${res.status} for movie ${tmdbId}`);
  return res.json();
}

export async function GET(req: NextRequest) {
  // Basic protection via shared secret (optional — set ADMIN_REPAIR_SECRET)
  const expectedSecret = process.env.ADMIN_REPAIR_SECRET;
  if (expectedSecret) {
    const provided = req.nextUrl.searchParams.get("secret");
    if (provided !== expectedSecret) {
      return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    }
  }

  try {
    let fixed = 0;
    const skipped: string[] = [];

    // WatchedMovie table (legacy) — may not exist on all DBs
    let watchedMovies: { id: string; tmdbId: number; title: string; posterPath: string | null }[] = [];
    try {
      watchedMovies = await db.watchedMovie.findMany({
        select: { id: true, tmdbId: true, title: true, posterPath: true },
      });
    } catch {
      skipped.push("watchedMovie table not available");
    }

    const mediaMovies = await db.media.findMany({
      where: { type: "movie", tmdbId: { not: null } },
      select: { id: true, tmdbId: true, title: true, poster: true },
    });

    const tmdbIds = [...new Set([...watchedMovies, ...mediaMovies].map((i) => i.tmdbId).filter(Boolean))] as number[];
    const posterByTmdbId = new Map<number, string | null>();

    let tmdbFailures = 0;
    for (const tmdbId of tmdbIds) {
      try {
        const movie = await tmdbMovie(tmdbId);
        posterByTmdbId.set(tmdbId, movie.poster_path || null);
      } catch (error: any) {
        tmdbFailures++;
        console.warn(`could not fetch movie ${tmdbId}: ${error.message}`);
      }
    }

    for (const item of watchedMovies) {
      if (item.tmdbId == null) continue;
      const posterPath = posterByTmdbId.get(item.tmdbId);
      if (posterPath && item.posterPath !== posterPath) {
        await db.watchedMovie.update({ where: { id: item.id }, data: { posterPath } });
        fixed++;
      }
    }

    for (const item of mediaMovies) {
      if (item.tmdbId == null) continue;
      const posterPath = posterByTmdbId.get(item.tmdbId);
      const poster = posterPath ? `https://image.tmdb.org/t/p/w500${posterPath}` : null;
      if (poster && item.poster !== poster) {
        await db.media.update({ where: { id: item.id }, data: { poster } });
        fixed++;
      }
    }

    return NextResponse.json({
      ok: true,
      fixed,
      scannedWatchedMovies: watchedMovies.length,
      scannedMediaMovies: mediaMovies.length,
      tmdbFetchFailures: tmdbFailures,
      skipped,
    });
  } catch (error: any) {
    console.error("[admin:repair-posters]", error);
    return NextResponse.json({ error: error?.message || "Failed" }, { status: 500 });
  }
}
