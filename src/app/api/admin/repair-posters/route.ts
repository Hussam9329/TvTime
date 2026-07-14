import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { enforceAdminSecret } from "@/lib/admin-guard";

const TMDB_API_KEY = process.env.TMDB_API_KEY?.trim();
const TMDB_BASE_URL = "https://api.themoviedb.org/3";

async function tmdbMovie(tmdbId: number) {
  if (!TMDB_API_KEY) throw new Error("TMDB_API_KEY is not configured");
  const url = new URL(`${TMDB_BASE_URL}/movie/${tmdbId}`);
  url.searchParams.set("api_key", TMDB_API_KEY);
  url.searchParams.set("language", "en-US");
  const res = await fetch(url);
  if (!res.ok) throw new Error(`TMDB ${res.status} for movie ${tmdbId}`);
  return res.json();
}

export async function GET(req: NextRequest) {
  // TVM-40: Always enforce admin secret
  const guard = enforceAdminSecret(req);
  if (guard) return guard;

  try {
    let fixed = 0;
    let tmdbFailures = 0;
    const mediaMovies = await db.media.findMany({
      where: { type: "movie", tmdbId: { not: null } },
      select: { id: true, tmdbId: true, title: true, poster: true },
    });
    const tmdbIds: number[] = Array.from(
      new Set(mediaMovies.map((item: { tmdbId: number | null }) => item.tmdbId).filter((id): id is number => id != null)),
    );
    const posterByTmdbId = new Map<number, string | null>();

    for (const tmdbId of tmdbIds) {
      try {
        const movie = await tmdbMovie(tmdbId);
        posterByTmdbId.set(tmdbId, movie.poster_path || null);
      } catch (error) {
        tmdbFailures++;
        console.warn(`[repair-posters] could not fetch movie ${tmdbId}`, error);
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
      scannedMediaMovies: mediaMovies.length,
      tmdbFetchFailures: tmdbFailures,
      source: "Media",
    });
  } catch (error: any) {
    console.error("[admin:repair-posters]", error);
    return NextResponse.json({ error: error?.message || "Failed" }, { status: 500 });
  }
}
