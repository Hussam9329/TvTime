import { notFound } from "next/navigation";
import { AppShell } from "@/components/app-shell";

export default async function PersonPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const personId = Number(id);
  if (!Number.isInteger(personId) || personId <= 0) notFound();
  return <AppShell initialRoute={{ view: "person-detail", movieId: null, tvId: null, personId }} />;
}
