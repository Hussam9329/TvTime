"use client";

import { useState } from "react";
import { Library, Sparkles } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { TvShowsView } from "@/components/views/tv-tracking-view";
import { DiscoverView } from "@/components/views/discover-view";

export function TVShowsPageView() {
  const [tab, setTab] = useState<"library" | "discover">("library");

  return (
    <div className="space-y-5">
      <Tabs value={tab} onValueChange={(v) => setTab(v as "library" | "discover")} className="space-y-5">
        <TabsList className="grid h-auto w-full grid-cols-2 gap-1 rounded-xl bg-muted/60 p-1 sm:w-[420px]">
          <TabsTrigger value="library" className="gap-2 py-2.5">
            <Library className="h-4 w-4" /> My Library
          </TabsTrigger>
          <TabsTrigger value="discover" className="gap-2 py-2.5">
            <Sparkles className="h-4 w-4" /> Discover
          </TabsTrigger>
        </TabsList>

        <TabsContent value="library" className="mt-0">
          <TvShowsView embedded />
        </TabsContent>
        <TabsContent value="discover" className="mt-0">
          <DiscoverView world="tv" embedded />
        </TabsContent>
      </Tabs>
    </div>
  );
}
