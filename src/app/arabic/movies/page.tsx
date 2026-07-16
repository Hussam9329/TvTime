import { AppShell } from "@/components/app-shell";

export default function ArabicMoviesPage() {
  return <AppShell initialRoute={{ view: "arabic-movies", movieId: null, tvId: null, personId: null }} />;
}
