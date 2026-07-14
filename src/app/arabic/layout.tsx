import type { Metadata } from "next";

/**
 * Layout for /arabic/* routes.
 *
 * Sets lang="ar" on the page wrapper so search engines and screen readers
 * understand the content language. We do NOT set dir="rtl" here because
 * the AppShell (header, footer, nav) is shared and designed LTR.
 *
 * dir="rtl" is applied INSIDE the Arabic view components themselves
 * (arabic-movies-view.tsx, arabic-tv-view.tsx) so only the Arabic content
 * section flips, while the app chrome stays LTR.
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
    <div lang="ar">
      {children}
    </div>
  );
}
