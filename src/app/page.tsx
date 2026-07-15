import { AppShell } from "@/components/app-shell";
import { navigationEntryFromPath } from "@/lib/navigation";

type HomePageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function Home({ searchParams }: HomePageProps) {
  const params = await searchParams;
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (Array.isArray(value)) value.forEach((item) => query.append(key, item));
    else if (value != null) query.set(key, value);
  }
  return <AppShell initialRoute={navigationEntryFromPath("/", query.toString())} />;
}
