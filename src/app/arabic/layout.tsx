import type { Metadata } from "next";
import { APP_NAME } from "@/lib/brand";

export const metadata: Metadata = {
  title: { default: `المحتوى العربي — ${APP_NAME}`, template: `%s — ${APP_NAME}` },
  description: "استكشف الأفلام والمسلسلات العربية مع تتبع المشاهدة والتقييمات.",
  openGraph: {
    title: `المحتوى العربي — ${APP_NAME}`,
    description: "استكشف الأفلام والمسلسلات العربية مع تتبع المشاهدة والتقييمات.",
    locale: "ar_IQ",
  },
};

/** AppShell stays LTR; each Arabic content view scopes RTL to its own content. */
export default function ArabicLayout({ children }: { children: React.ReactNode }) {
  return children;
}
