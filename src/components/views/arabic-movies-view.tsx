"use client";

import { useState } from "react";
import { CalendarDays, Languages, Library, Sparkles } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { CollectionWorldView } from "@/components/views/collection-world-view";
import { DiscoverView } from "@/components/views/discover-view";
import { ReleaseSchedule } from "@/components/views/movie-release-schedule";

export function ArabicMoviesView() {
  const [tab, setTab] = useState<"library" | "discover" | "releases">("library");

  return (
    <div className="tvtime-arabic-movies-page space-y-5">
      <section className="tvtime-page-hero rounded-2xl border border-emerald-500/20 bg-gradient-to-br from-emerald-500/10 via-card to-card p-4 sm:p-5">
        <div className="view-page-header flex items-start gap-3">
          <Languages className="mt-0.5 h-5 w-5 shrink-0 text-emerald-400" />
          <div className="min-w-0">
            <h1 className="view-page-title text-xl font-extrabold tracking-tight">Arabic Movies</h1>
            <p className="view-page-description mt-1 text-sm text-muted-foreground">
              Track Arabic films you&apos;ve watched, discover new ones, and stay on top of upcoming releases.
            </p>
          </div>
        </div>
      </section>

      <Tabs value={tab} onValueChange={(value) => setTab(value as typeof tab)} className="space-y-5">
        <TabsList className="tvtime-world-tabs grid h-auto w-full grid-cols-3 gap-1 rounded-xl bg-muted/60 p-1 sm:w-[620px]">
          <TabsTrigger value="library" className="gap-2 py-2.5">
            <Library className="h-4 w-4" /> My Arabic Movies
          </TabsTrigger>
          <TabsTrigger value="discover" className="gap-2 py-2.5">
            <Sparkles className="h-4 w-4" /> Discover
          </TabsTrigger>
          <TabsTrigger value="releases" className="gap-2 py-2.5">
            <CalendarDays className="h-4 w-4" /> Releases
          </TabsTrigger>
        </TabsList>

        <TabsContent value="library" className="mt-0">
          <CollectionWorldView world="arabic-movies" embedded />
        </TabsContent>
        <TabsContent value="discover" className="mt-0">
          <DiscoverView world="arabic-movies" embedded />
        </TabsContent>
        <TabsContent value="releases" className="mt-0">
          <ReleaseSchedule
            accentClass="text-emerald-400"
            originalLanguage="ar"
            language="ar"
            title="Arabic Movie Release Schedule"
            subtitle="A six-month release agenda for Arabic-language films. Dates are handled as date-only values and never shift with timezone conversion."
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}
