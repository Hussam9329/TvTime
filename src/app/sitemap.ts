import type { MetadataRoute } from "next";

// Trakora is a private, authenticated personal library. Publishing tracked
// TMDB ids in a public sitemap leaks library contents, so there are no public
// crawl targets.
export default function sitemap(): MetadataRoute.Sitemap {
  return [];
}
