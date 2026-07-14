import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { tmdb } from "@/lib/tmdb";

type Props = {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  const personId = Number(id);
  if (!Number.isInteger(personId) || personId <= 0) {
    return { title: "Person not found" };
  }

  try {
    const person = await tmdb.personDetail(personId);
    const name = person.name || `Person #${personId}`;
    const description = person.biography
      ? person.biography.slice(0, 160)
      : `Filmography and credits for ${name} on TvTime.`;
    const profile = person.profile_path
      ? `https://image.tmdb.org/t/p/w500${person.profile_path}`
      : null;

    return {
      title: name,
      description,
      alternates: {
        canonical: `/person/${personId}`,
      },
      openGraph: {
        title: `${name} — TvTime`,
        description,
        type: "profile",
        url: `/person/${personId}`,
        images: profile
          ? [
              {
                url: profile,
                width: 500,
                height: 750,
                alt: `${name} profile photo`,
              },
            ]
          : [],
        siteName: "TvTime",
      },
      twitter: {
        card: "summary_large_image",
        title: `${name} — TvTime`,
        description,
        images: profile ? [profile] : [],
      },
    };
  } catch {
    return {
      title: `Person #${personId}`,
      description: "Person details on TvTime.",
    };
  }
}

export default async function PersonPage({ params, searchParams }: Props) {
  const { id } = await params;
  const personId = Number(id);
  if (!Number.isInteger(personId) || personId <= 0) notFound();

  const sp = await searchParams;
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(sp)) {
    if (Array.isArray(value)) value.forEach((item) => query.append(key, item));
    else if (value != null) query.set(key, value);
  }
  return (
    <AppShell
      initialRoute={{
        view: "person-detail",
        movieId: null,
        tvId: null,
        personId,
      }}
      key={query.toString()}
    />
  );
}
