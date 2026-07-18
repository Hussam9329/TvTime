"use client";

import { useState } from "react";
import { CalendarDays, Languages, ListChecks, Sparkles } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { TvShowsView } from "@/components/views/tv-tracking-view";
import { ArabicDiscoverCatalog } from "@/components/views/arabic-discover-catalog";
import { ReleaseSchedule } from "@/components/views/movie-release-schedule";

const ANIMATION_GENRES = [16];

export function ArabicTvView() {
  const [tab, setTab] = useState<"tracking" | "discover" | "releases">("tracking");

  return (
    <div className="space-y-6">
      <section className="overflow-hidden rounded-2xl border border-amber-500/20 bg-gradient-to-br from-amber-500/15 via-card to-card p-5 sm:p-7">
        <div className="view-page-header max-w-2xl">
          <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-amber-400/25 bg-amber-500/10 px-3 py-1 text-xs font-bold text-amber-300">
            <Languages className="h-3.5 w-3.5" /> Independent Arabic television world
          </div>
          <h1 className="view-page-title text-3xl font-black tracking-tight sm:text-4xl">Arabic TV Shows</h1>
          <p className="view-page-description mt-2 text-sm leading-relaxed text-muted-foreground sm:text-base">
            Track Arabic series, discover new productions and browse new releases without mixing them into the standard TV Shows or Anime worlds.
          </p>
        </div>
      </section>

      <Tabs value={tab} onValueChange={(value) => setTab(value as typeof tab)} className="space-y-5">
        <TabsList className="grid h-auto w-full grid-cols-3 gap-1 rounded-xl bg-muted/60 p-1 sm:w-[620px]">
          <TabsTrigger value="tracking" className="gap-2 py-2.5">
            <ListChecks className="h-4 w-4" /> Tracking
          </TabsTrigger>
          <TabsTrigger value="discover" className="gap-2 py-2.5">
            <Sparkles className="h-4 w-4" /> Discover
          </TabsTrigger>
          <TabsTrigger value="releases" className="gap-2 py-2.5">
            <CalendarDays className="h-4 w-4" /> Releases
          </TabsTrigger>
        </TabsList>

        <TabsContent value="tracking" className="mt-0">
          <TvShowsView world="arabic" embedded />
        </TabsContent>
        <TabsContent value="discover" className="mt-0">
          <ArabicDiscoverCatalog kind="tv" />
        </TabsContent>
        <TabsContent value="releases" className="mt-0">
          <ReleaseSchedule
            mediaType="tv"
            originalLanguage="ar"
            language="ar"
            withoutGenres={ANIMATION_GENRES}
            accentClass="text-amber-400"
            title="Arabic TV Releases"
            subtitle="A six-month agenda for new Arabic TV premieres, kept separate from standard TV Shows and Anime."
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}
