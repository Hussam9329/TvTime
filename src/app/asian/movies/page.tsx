import type { Metadata } from "next";
import { AppShell } from "@/components/app-shell";

export const metadata: Metadata = {
  title: "Asian Movies",
  description: "Track and discover movies from across Asia.",
  alternates: { canonical: "/asian/movies" },
};

export default function AsianMoviesPage() {
  return <AppShell initialRoute={{ view: "asian-movies", movieId: null, tvId: null, personId: null }} />;
}
