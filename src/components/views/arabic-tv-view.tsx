"use client";

import { useState } from "react";
import { CalendarDays, Languages, ListChecks, Sparkles } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { TvShowsView } from "@/components/views/tv-tracking-view";
import { DiscoverView } from "@/components/views/discover-view";
import { ReleaseSchedule } from "@/components/views/movie-release-schedule";

const ANIMATION_GENRES = [16];

export function ArabicTvView() {
  const [tab, setTab] = useState<"tracking" | "discover" | "releases">("tracking");

  return (
    <div className="tvtime-arabic-tv-page space-y-6" dir="rtl" lang="ar">
      <section data-ui-surface="hero" className="tvtime-page-hero overflow-hidden rounded-2xl border border-amber-500/20 bg-gradient-to-br from-amber-500/15 via-card to-card p-5 sm:p-7">
        <div className="view-page-header max-w-2xl">
          <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-amber-400/25 bg-amber-500/10 px-3 py-1 text-xs font-bold text-amber-300">
            <Languages className="h-3.5 w-3.5" /> عالم مستقل للمسلسلات العربية
          </div>
          <h1 className="view-page-title text-3xl font-black tracking-tight sm:text-4xl">المسلسلات العربية</h1>
          <p className="view-page-description mt-2 text-sm leading-relaxed text-muted-foreground sm:text-base">
            تتبّع المسلسلات العربية، واكتشف إنتاجات جديدة، وتابع الإصدارات دون خلطها بالمسلسلات العالمية أو الأنمي.
          </p>
        </div>
      </section>

      <Tabs value={tab} onValueChange={(value) => setTab(value as typeof tab)} className="space-y-5">
        <TabsList className="tvtime-world-tabs grid h-auto w-full grid-cols-3 gap-1 rounded-xl bg-muted/60 p-1 sm:w-[620px]">
          <TabsTrigger value="tracking" className="gap-2 py-2.5">
            <ListChecks className="h-4 w-4" /> المتابعة
          </TabsTrigger>
          <TabsTrigger value="discover" className="gap-2 py-2.5">
            <Sparkles className="h-4 w-4" /> اكتشاف
          </TabsTrigger>
          <TabsTrigger value="releases" className="gap-2 py-2.5">
            <CalendarDays className="h-4 w-4" /> الإصدارات
          </TabsTrigger>
        </TabsList>

        <TabsContent value="tracking" className="mt-0">
          <TvShowsView world="arabic" embedded />
        </TabsContent>
        <TabsContent value="discover" className="mt-0">
          <DiscoverView world="arabic-tv" embedded title="اكتشف مسلسلات عربية" subtitle="ابحث عن إنتاجات عربية جديدة وأضفها إلى مكتبتك" />
        </TabsContent>
        <TabsContent value="releases" className="mt-0">
          <ReleaseSchedule
            mediaType="tv"
            originalLanguage="ar"
            language="ar"
            withoutGenres={ANIMATION_GENRES}
            accentClass="text-amber-400"
            title="Arabic TV الإصدارات"
            subtitle="جدول لستة أشهر من العروض العربية الجديدة، منفصل عن المسلسلات العالمية والأنمي."
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}
