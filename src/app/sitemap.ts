import type { MetadataRoute } from "next";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";
// Re-generate at most once per hour. Vercel caches the output and serves
// stale while revalidating.
export const revalidate = 3600;

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const baseUrl = "https://tvtime-iota.vercel.app";

  // Static pages — the views that don't depend on a TMDB id.
  const staticPages: MetadataRoute.Sitemap = [
    {
      url: baseUrl,
      changeFrequency: "daily",
      priority: 1,
      lastModified: new Date(),
    },
    {
      url: `${baseUrl}/arabic/movies`,
      changeFrequency: "weekly",
      priority: 0.6,
      lastModified: new Date(),
    },
    {
      url: `${baseUrl}/arabic/tv`,
      changeFrequency: "weekly",
      priority: 0.6,
      lastModified: new Date(),
    },
  ];

  // Dynamic pages — one URL per tracked media item with a TMDB id.
  // We only include items the user has actually added to their library
  // (not every TMDB id in existence). This keeps the sitemap focused on
  // real content.
  try {
    const [movies, series] = await Promise.all([
      db.media.findMany({
        where: { type: "movie", tmdbId: { not: null } },
        select: { tmdbId: true, updatedAt: true },
        take: 5000,
      }),
      db.media.findMany({
        where: { type: "series", tmdbId: { not: null } },
        select: { tmdbId: true, updatedAt: true },
        take: 5000,
      }),
    ]);

    const movieUrls: MetadataRoute.Sitemap = movies.map((m) => ({
      url: `${baseUrl}/movie/${m.tmdbId}`,
      lastModified: m.updatedAt,
      changeFrequency: "monthly" as const,
      priority: 0.7,
    }));

    const seriesUrls: MetadataRoute.Sitemap = series.map((s) => ({
      url: `${baseUrl}/tv/${s.tmdbId}`,
      lastModified: s.updatedAt,
      changeFrequency: "weekly" as const,
      priority: 0.7,
    }));

    return [...staticPages, ...movieUrls, ...seriesUrls];
  } catch {
    // If the DB is unreachable, return just the static pages so the
    // sitemap doesn't 500.
    return staticPages;
  }
}
