"use client";

import { useState } from "react";
import { Library, Sparkles, CalendarDays } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PageTitlebar } from "@/components/ui/page-titlebar";
import { CollectionWorldView } from "@/components/views/collection-world-view";
import { DiscoverView } from "@/components/views/discover-view";
import { ReleaseSchedule } from "@/components/views/movie-release-schedule";

export function MoviesView() {
  const [tab, setTab] = useState<"library" | "discover" | "releases">("library");

  return (
    <div className="tvtime-world-view tvtime-movies-view space-y-5">
      <PageTitlebar title="Movies" />

      <Tabs value={tab} onValueChange={(v) => setTab(v as "library" | "discover" | "releases")} className="space-y-5">
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
          <CollectionWorldView world="movies" embedded />
        </TabsContent>
        <TabsContent value="discover" className="mt-0">
          <DiscoverView world="movies" embedded />
        </TabsContent>
        <TabsContent value="releases" className="mt-0">
          <ReleaseSchedule
            title="Movie Release Schedule"
            subtitle="A six-month release agenda for upcoming films. Dates are handled as date-only values and never shift with timezone conversion."
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}
