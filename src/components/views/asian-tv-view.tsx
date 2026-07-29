"use client";

import { useState } from "react";
import { CalendarDays, Globe2, Library, Sparkles } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { TvShowsView } from "@/components/views/tv-tracking-view";
import { DiscoverView } from "@/components/views/discover-view";
import { ReleaseSchedule } from "@/components/views/movie-release-schedule";

const ANIMATION_GENRES = [16];

export function AsianTvView() {
  const [tab, setTab] = useState<"library" | "discover" | "releases">("library");

  return (
    <div className="tvtime-world-view tvtime-asian-tv-page space-y-5">
      <section data-ui-surface="hero" className="tvtime-page-hero rounded-2xl border border-teal-400/20 bg-gradient-to-br from-teal-500/15 via-card to-card p-4 sm:p-6">
        <div className="view-page-header flex items-start gap-3">
          <Globe2 className="mt-0.5 h-5 w-5 shrink-0 text-teal-300" />
          <div className="min-w-0">
            <h1 className="view-page-title text-xl font-extrabold tracking-tight sm:text-2xl">Asian TV Shows</h1>
            <p className="view-page-description mt-1 text-sm text-muted-foreground">A separate home for Asian series, prioritizing Korea, Japan and China before the rest of Asia.</p>
          </div>
        </div>
      </section>

      <Tabs value={tab} onValueChange={(value) => setTab(value as typeof tab)} className="space-y-5">
        <TabsList className="tvtime-world-tabs grid h-auto w-full grid-cols-3 gap-1 rounded-xl bg-muted/60 p-1 sm:w-[620px]">
          <TabsTrigger value="library" className="gap-2 py-2.5"><Library className="h-4 w-4" /> My Library</TabsTrigger>
          <TabsTrigger value="discover" className="gap-2 py-2.5"><Sparkles className="h-4 w-4" /> Discover</TabsTrigger>
          <TabsTrigger value="releases" className="gap-2 py-2.5"><CalendarDays className="h-4 w-4" /> Releases</TabsTrigger>
        </TabsList>
        <TabsContent value="library" className="mt-0"><TvShowsView world="asian" embedded /></TabsContent>
        <TabsContent value="discover" className="mt-0"><DiscoverView world="asian-tv" embedded /></TabsContent>
        <TabsContent value="releases" className="mt-0">
          <ReleaseSchedule mediaType="tv" withoutGenres={ANIMATION_GENRES} collectionWorld="asian-tv" accentClass="text-teal-300" title="Asian TV Release Schedule" subtitle="Upcoming Asian series, ordered with Korea, Japan and China first." />
        </TabsContent>
      </Tabs>
    </div>
  );
}
