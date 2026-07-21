import type { Metadata } from "next";
import { AppShell } from "@/components/app-shell";

export const metadata: Metadata = {
  title: "الأفلام العربية",
  description: "تتبّع الأفلام العربية واكتشف الإصدارات الجديدة.",
  alternates: { canonical: "/arabic/movies", languages: { ar: "/arabic/movies" } },
};

export default function ArabicMoviesPage() {
  return <AppShell initialRoute={{ view: "arabic-movies", movieId: null, tvId: null, personId: null }} />;
}
