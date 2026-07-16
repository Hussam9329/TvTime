import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  const baseUrl = "https://tvtime-iota.vercel.app";
  return {
    rules: {
      userAgent: "*",
      allow: ["/", "/movie/", "/tv/", "/person/", "/arabic/"],
      disallow: ["/api/", "/login"],
    },
    sitemap: `${baseUrl}/sitemap.xml`,
    host: baseUrl,
  };
}
