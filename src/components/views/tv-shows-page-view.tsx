"use client";

import { useState } from "react";
import { CalendarDays, Library, Sparkles, Tv } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { TvShowsView } from "@/components/views/tv-tracking-view";
import { DiscoverView } from "@/components/views/discover-view";
import { ReleaseSchedule } from "@/components/views/movie-release-schedule";

const ANIMATION_GENRES = [16];

export function TVShowsPageView() {
  const [tab, setTab] = useState<"library" | "discover" | "releases">("library");

  return (
    <div className="tvtime-world-view tvtime-tv-view space-y-5">
      <section className="tvtime-page-hero rounded-2xl border border-sky-500/20 bg-gradient-to-br from-sky-500/10 via-card to-card p-4 sm:p-5">
        <div className="view-page-header flex items-start gap-3">
          <Tv className="mt-0.5 h-5 w-5 shrink-0 text-sky-400" />
          <div className="min-w-0">
            <h1 className="view-page-title text-xl font-extrabold tracking-tight">TV Shows</h1>
            <p className="view-page-description mt-1 text-sm text-muted-foreground">
              Continue your shows, discover new series, and follow upcoming television premieres.
            </p>
          </div>
        </div>
      </section>

      <Tabs value={tab} onValueChange={(v) => setTab(v as typeof tab)} className="space-y-5">
        <TabsList className="tvtime-world-tabs grid h-auto w-full grid-cols-3 gap-1 rounded-xl bg-muted/60 p-1 sm:w-[620px]">
          <TabsTrigger value="library" className="gap-2 py-2.5">
            <Library className="h-4 w-4" /> My Library
          </TabsTrigger>
          <TabsTrigger value="discover" className="gap-2 py-2.5">
            <Sparkles className="h-4 w-4" /> Discover
          </TabsTrigger>
          <TabsTrigger value="releases" className="gap-2 py-2.5">
            <CalendarDays className="h-4 w-4" /> Releases
          </TabsTrigger>
        </TabsList>

        <TabsContent value="library" className="mt-0">
          <TvShowsView embedded />
        </TabsContent>
        <TabsContent value="discover" className="mt-0">
          <DiscoverView world="tv" embedded />
        </TabsContent>
        <TabsContent value="releases" className="mt-0">
          <ReleaseSchedule
            mediaType="tv"
            withoutGenres={ANIMATION_GENRES}
            excludedOriginalLanguage="ar"
            title="TV Release Schedule"
            subtitle="A six-month agenda for new TV show premieres, kept separate from Anime and Arabic TV."
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}
