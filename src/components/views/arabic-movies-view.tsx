"use client";

import { useState } from "react";
import { CalendarDays, Languages, Library, Sparkles } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { CollectionWorldView } from "@/components/views/collection-world-view";
import { ArabicDiscoverCatalog } from "@/components/views/arabic-discover-catalog";
import { ArabicMovieReleaseSchedule } from "@/components/views/arabic-movie-schedule";

export function ArabicMoviesView() {
  const [tab, setTab] = useState<"library" | "discover" | "schedule">("library");

  return (
    <div className="space-y-6">
      <section className="overflow-hidden rounded-2xl border border-emerald-500/20 bg-gradient-to-br from-emerald-500/15 via-card to-card p-5 sm:p-7">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div className="max-w-2xl">
            <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-emerald-400/25 bg-emerald-500/10 px-3 py-1 text-xs font-bold text-emerald-300">
              <Languages className="h-3.5 w-3.5" /> عالم السينما العربية المستقل
            </div>
            <h1 className="text-3xl font-black tracking-tight sm:text-4xl">الأفلام العربية</h1>
            <p className="mt-2 text-sm leading-relaxed text-muted-foreground sm:text-base">
              مكتبتك لأفلام العالم العربي وكتالوج الاكتشاف، منفصلة عن الأفلام والمسلسلات والأنمي العالمية مع إتاحتها في البحث الشامل.
            </p>
          </div>
        </div>
      </section>

      <Tabs value={tab} onValueChange={(value) => setTab(value as typeof tab)} className="space-y-5">
        <TabsList className="grid h-auto w-full grid-cols-3 gap-1 rounded-xl bg-muted/60 p-1 sm:w-[620px]">
          <TabsTrigger value="library" className="gap-2 py-2.5">
            <Library className="h-4 w-4" /> مكتبتي
          </TabsTrigger>
          <TabsTrigger value="discover" className="gap-2 py-2.5">
            <Sparkles className="h-4 w-4" /> استكشاف
          </TabsTrigger>
          <TabsTrigger value="schedule" className="gap-2 py-2.5">
            <CalendarDays className="h-4 w-4" /> الإصدارات
          </TabsTrigger>
        </TabsList>

        <TabsContent value="library" className="mt-0">
          <CollectionWorldView world="arabic-movies" embedded />
        </TabsContent>
        <TabsContent value="discover" className="mt-0">
          <ArabicDiscoverCatalog kind="movie" />
        </TabsContent>
        <TabsContent value="schedule" className="mt-0">
          <ArabicMovieReleaseSchedule />
        </TabsContent>
      </Tabs>
    </div>
  );
}
