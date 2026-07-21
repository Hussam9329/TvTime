import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Film, Globe2, Tv } from "lucide-react";
import { db } from "@/lib/db";
import { SafeImage } from "@/components/media/safe-image";
import { img } from "@/lib/tmdb";

export const revalidate = 60;

type PageProps = { params: Promise<{ slug: string }> };

async function readPublicList(slug: string) {
  return db.customList.findFirst({
    where: { slug, isPublic: true },
    select: {
      name: true,
      description: true,
      color: true,
      slug: true,
      updatedAt: true,
      items: {
        orderBy: [{ order: "asc" }, { addedAt: "asc" }],
        select: { tmdbId: true, mediaType: true, title: true, posterPath: true },
      },
    },
  });
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const list = await readPublicList(slug);
  if (!list) return { title: "List not found · TvTime", robots: { index: false, follow: false } };
  const description = list.description || `${list.items.length} titles shared from TvTime.`;
  return {
    title: `${list.name} · TvTime`,
    description,
    alternates: { canonical: `/list/${encodeURIComponent(list.slug)}` },
    openGraph: { title: list.name, description, type: "website" },
  };
}

export default async function PublicListPage({ params }: PageProps) {
  const { slug } = await params;
  const list = await readPublicList(slug);
  if (!list) notFound();

  return (
    <main className="min-h-screen bg-background text-foreground">
      <div className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-6 sm:py-12">
        <header className="mb-8 overflow-hidden rounded-2xl border border-border bg-card">
          <div className="h-2" style={{ backgroundColor: list.color }} />
          <div className="space-y-3 p-5 sm:p-8">
            <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
              <Globe2 className="h-4 w-4" /> Public TvTime list
            </div>
            <h1 className="text-3xl font-black tracking-tight sm:text-4xl">{list.name}</h1>
            {list.description && <p className="max-w-3xl text-sm leading-6 text-muted-foreground sm:text-base">{list.description}</p>}
            <p className="text-sm text-muted-foreground">{list.items.length.toLocaleString()} titles</p>
          </div>
        </header>

        {list.items.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-border py-20 text-center text-muted-foreground">
            This public list does not contain any titles yet.
          </div>
        ) : (
          <section aria-label="List titles" className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
            {list.items.map((item) => {
              const kind = item.mediaType === "tv" ? "tv" : "movie";
              return (
                <Link
                  key={`${kind}:${item.tmdbId}`}
                  href={`/${kind}/${item.tmdbId}`}
                  className="group rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                >
                  <div className="relative aspect-[2/3] overflow-hidden rounded-xl border border-border bg-muted shadow-sm">
                    {item.posterPath ? (
                      <SafeImage src={img(item.posterPath, "w342")} alt={item.title} fill variant="poster" className="transition-transform duration-200 group-hover:scale-[1.03]" />
                    ) : (
                      <div className="flex h-full items-center justify-center text-muted-foreground">
                        {kind === "tv" ? <Tv className="h-8 w-8" /> : <Film className="h-8 w-8" />}
                      </div>
                    )}
                  </div>
                  <h2 className="mt-2 line-clamp-2 text-sm font-semibold leading-5 group-hover:text-primary">{item.title}</h2>
                  <p className="mt-0.5 text-xs text-muted-foreground">{kind === "tv" ? "TV series" : "Movie"}</p>
                </Link>
              );
            })}
          </section>
        )}
      </div>
    </main>
  );
}
