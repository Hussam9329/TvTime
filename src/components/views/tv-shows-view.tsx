"use client";

import { useState } from "react";
import { Compass, ListChecks } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { TvShowsView } from "@/components/views/tv-tracking-view";
import { DiscoverView } from "@/components/views/discover-view";

export function TvShowsPageView() {
  const [tab, setTab] = useState<"library" | "discover">("library");

  return (
    <Tabs value={tab} onValueChange={(v) => setTab(v as typeof tab)} className="space-y-6">
      <TabsList className="grid h-auto w-full grid-cols-2 gap-1 rounded-xl bg-muted/60 p-1 sm:w-[400px]">
        <TabsTrigger value="library" className="gap-2 py-2.5">
          <ListChecks className="h-4 w-4" /> Tracking
        </TabsTrigger>
        <TabsTrigger value="discover" className="gap-2 py-2.5">
          <Compass className="h-4 w-4" /> Discover TV
        </TabsTrigger>
      </TabsList>

      <TabsContent value="library" className="mt-0">
        <TvShowsView embedded />
      </TabsContent>
      <TabsContent value="discover" className="mt-0">
        <DiscoverView forceTab="tv" embedded />
      </TabsContent>
    </Tabs>
  );
}
