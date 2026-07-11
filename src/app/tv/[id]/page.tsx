import { notFound } from "next/navigation";
import { AppShell } from "@/components/app-shell";

export default async function TvPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const tvId = Number(id);
  if (!Number.isInteger(tvId) || tvId <= 0) notFound();
  return <AppShell initialRoute={{ view: "tv-detail", movieId: null, tvId, personId: null }} />;
}
