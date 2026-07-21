import type { Metadata } from "next";

export const metadata: Metadata = {
  title: { default: "المحتوى العربي — TvTime", template: "%s — TvTime" },
  description: "استكشف الأفلام والمسلسلات العربية مع تتبع المشاهدة والتقييمات.",
  openGraph: {
    title: "المحتوى العربي — TvTime",
    description: "استكشف الأفلام والمسلسلات العربية مع تتبع المشاهدة والتقييمات.",
    locale: "ar_IQ",
  },
};

/** AppShell stays LTR; each Arabic content view scopes RTL to its own content. */
export default function ArabicLayout({ children }: { children: React.ReactNode }) {
  return children;
}
