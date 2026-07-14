"use client";

import { useState } from "react";
import { CalendarDays, Languages, ListChecks, Sparkles } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { TvShowsView } from "@/components/views/tv-tracking-view";
import { ArabicDiscoverCatalog } from "@/components/views/arabic-discover-catalog";
import { CalendarView } from "@/components/views/calendar-view";

export function ArabicTvView() {
  const [tab, setTab] = useState<"tracking" | "discover" | "schedule">("tracking");

  return (
    <div className="space-y-6">
      <section className="overflow-hidden rounded-2xl border border-amber-500/20 bg-gradient-to-br from-amber-500/15 via-card to-card p-5 sm:p-7">
        <div className="max-w-2xl">
          <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-amber-400/25 bg-amber-500/10 px-3 py-1 text-xs font-bold text-amber-300">
            <Languages className="h-3.5 w-3.5" /> عالم التلفزيون العربي المستقل
          </div>
          <h1 className="text-3xl font-black tracking-tight sm:text-4xl">المسلسلات العربية</h1>
          <p className="mt-2 text-sm leading-relaxed text-muted-foreground sm:text-base">
            تتبّع المسلسلات العربية، اكتشف إنتاجات جديدة وتابع جدول إصداراتها دون خلطها مع المسلسلات العالمية أو الأنمي.
          </p>
        </div>
      </section>

      <Tabs value={tab} onValueChange={(value) => setTab(value as typeof tab)} className="space-y-5">
        <TabsList className="grid h-auto w-full grid-cols-3 gap-1 rounded-xl bg-muted/60 p-1 sm:w-[620px]">
          <TabsTrigger value="tracking" className="gap-2 py-2.5">
            <ListChecks className="h-4 w-4" /> التتبع
          </TabsTrigger>
          <TabsTrigger value="discover" className="gap-2 py-2.5">
            <Sparkles className="h-4 w-4" /> استكشاف
          </TabsTrigger>
          <TabsTrigger value="schedule" className="gap-2 py-2.5">
            <CalendarDays className="h-4 w-4" /> الجدولة
          </TabsTrigger>
        </TabsList>

        <TabsContent value="tracking" className="mt-0">
          <TvShowsView world="arabic" embedded />
        </TabsContent>
        <TabsContent value="discover" className="mt-0">
          <ArabicDiscoverCatalog kind="tv" />
        </TabsContent>
        <TabsContent value="schedule" className="mt-0">
          <CalendarView world="arabic-tv" embedded />
        </TabsContent>
      </Tabs>
    </div>
  );
}
