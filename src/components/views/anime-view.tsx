"use client";

import { useState } from "react";
import { CalendarDays, Library, Sparkles } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { CollectionWorldView } from "@/components/views/collection-world-view";
import { DiscoverView } from "@/components/views/discover-view";
import { ReleaseSchedule } from "@/components/views/movie-release-schedule";

const ANIMATION_GENRES = [16];

export function AnimeView() {
  const [tab, setTab] = useState<"library" | "discover" | "releases">("library");

  return (
    <div className="space-y-5">
      <Tabs value={tab} onValueChange={(v) => setTab(v as typeof tab)} className="space-y-5">
        <TabsList className="grid h-auto w-full grid-cols-3 gap-1 rounded-xl bg-muted/60 p-1 sm:w-[620px]">
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
          <CollectionWorldView world="anime" embedded />
        </TabsContent>
        <TabsContent value="discover" className="mt-0">
          <DiscoverView world="anime" embedded />
        </TabsContent>
        <TabsContent value="releases" className="mt-0">
          <ReleaseSchedule
            mediaType="tv"
            genres={ANIMATION_GENRES}
            originalLanguage="ja"
            language="ja"
            accentClass="text-fuchsia-400"
            title="Anime Release Schedule"
            subtitle="A six-month agenda for new Japanese anime premieres, separate from standard TV shows."
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}
