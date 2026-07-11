import { notFound } from "next/navigation";
import { AppShell } from "@/components/app-shell";

export default async function MoviePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const movieId = Number(id);
  if (!Number.isInteger(movieId) || movieId <= 0) notFound();
  return <AppShell initialRoute={{ view: "movie-detail", movieId, tvId: null, personId: null }} />;
}
