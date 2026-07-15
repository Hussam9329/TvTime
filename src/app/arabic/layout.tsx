import type { Metadata } from "next";

/**
 * Layout for /arabic/* routes.
 *
 * Sets lang="ar" and dir="rtl" on the page wrapper so:
 * - Screen readers pronounce Arabic content correctly
 * - Search engines understand the content language
 * - Future RTL-aware CSS can target [dir="rtl"]
 *
 * Note: we DON'T set <html dir> because the rest of the app is LTR English.
 * The dir="rtl" wrapper scopes RTL to the arabic section only. The header
 * and footer remain LTR for consistency with the rest of the app.
 */
export const metadata: Metadata = {
  title: "المحتوى العربي — TvTime",
  description: "استكشف الأفلام والمسلسلات العربية مع تتبع المشاهدة والتقييمات.",
  alternates: {
    canonical: "/arabic/movies",
    languages: {
      ar: "/arabic/movies",
    },
  },
  openGraph: {
    title: "المحتوى العربي — TvTime",
    description: "استكشف الأفلام والمسلسلات العربية مع تتبع المشاهدة والتقييمات.",
    locale: "ar",
  },
};

export default function ArabicLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div dir="rtl" lang="ar">
      {children}
    </div>
  );
}
