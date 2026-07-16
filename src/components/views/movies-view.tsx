"use client";

import { useState } from "react";
import { Library, Sparkles, CalendarDays, Film } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { CollectionWorldView } from "@/components/views/collection-world-view";
import { DiscoverView } from "@/components/views/discover-view";
import { MovieReleaseSchedule } from "@/components/views/movie-release-schedule";

export function MoviesView() {
  const [tab, setTab] = useState<"library" | "discover" | "releases">("library");

  return (
    <div className="space-y-5">
      {/* Hero banner — matches Arabic Movies page structure */}
      <div className="rounded-2xl border border-border/60 bg-gradient-to-br from-primary/10 via-card to-card p-4 sm:p-5">
        <div className="flex items-center gap-3">
          <Film className="h-5 w-5 text-primary" />
          <div>
            <h2 className="text-xl font-extrabold tracking-tight">Movies</h2>
            <p className="mt-0.5 text-sm text-muted-foreground">
              Track films you've watched, discover new ones, and stay on top of upcoming releases.
            </p>
          </div>
        </div>
      </div>

      <Tabs value={tab} onValueChange={(v) => setTab(v as "library" | "discover" | "releases")} className="space-y-5">
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
          <CollectionWorldView world="movies" embedded />
        </TabsContent>
        <TabsContent value="discover" className="mt-0">
          <DiscoverView world="movies" embedded />
        </TabsContent>
        <TabsContent value="releases" className="mt-0">
          <MovieReleaseSchedule
            title="Movie Release Schedule"
            subtitle="A six-month release agenda for upcoming films. Dates are handled as date-only values and never shift with timezone conversion."
            badgeLabel="Movie"
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}
