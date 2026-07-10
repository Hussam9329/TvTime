import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

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
  const expectedSecret = process.env.ADMIN_REPAIR_SECRET;
  if (expectedSecret && req.nextUrl.searchParams.get("secret") !== expectedSecret) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  try {
    const mediaMovies = await db.media.findMany({
      where: { type: "movie", tmdbId: { not: null } },
      select: { id: true, tmdbId: true, title: true, poster: true },
    });

    let fixed = 0;
    let tmdbFetchFailures = 0;
    for (const item of mediaMovies) {
      if (!item.tmdbId) continue;
      try {
        const movie = await tmdbMovie(item.tmdbId);
        const poster = movie.poster_path ? `https://image.tmdb.org/t/p/w500${movie.poster_path}` : null;
        if (poster && item.poster !== poster) {
          await db.media.update({ where: { id: item.id }, data: { poster } });
          fixed++;
        }
      } catch (error) {
        tmdbFetchFailures++;
        console.warn("[admin:repair-posters] TMDB fetch failed", item.tmdbId, error);
      }
    }

    return NextResponse.json({ ok: true, fixed, scannedMediaMovies: mediaMovies.length, tmdbFetchFailures });
  } catch (error: any) {
    console.error("[admin:repair-posters]", error);
    return NextResponse.json({ error: error?.message || "Failed" }, { status: 500 });
  }
}
