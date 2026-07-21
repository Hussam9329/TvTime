import type { Metadata } from "next";
import { AppShell } from "@/components/app-shell";

export const metadata: Metadata = {
  title: "المسلسلات العربية",
  description: "تتبّع المسلسلات العربية واكتشف الإنتاجات والحلقات الجديدة.",
  alternates: { canonical: "/arabic/tv", languages: { ar: "/arabic/tv" } },
};

export default function ArabicTvPage() {
  return <AppShell initialRoute={{ view: "arabic-tv", movieId: null, tvId: null, personId: null }} />;
}
