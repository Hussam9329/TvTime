"use client";

import { useState } from "react";
import { CalendarDays, Library, Sparkles } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PageTitlebar } from "@/components/ui/page-titlebar";
import { CollectionWorldView } from "@/components/views/collection-world-view";
import { DiscoverView } from "@/components/views/discover-view";
import { ReleaseSchedule } from "@/components/views/movie-release-schedule";

export function ArabicMoviesView() {
  const [tab, setTab] = useState<"library" | "discover" | "releases">("library");

  return (
    <div className="tvtime-arabic-movies-page space-y-5" dir="rtl" lang="ar">
      <PageTitlebar title="الأفلام العربية" />

      <Tabs value={tab} onValueChange={(value) => setTab(value as typeof tab)} className="space-y-5">
        <TabsList className="tvtime-world-tabs grid h-auto w-full grid-cols-3 gap-1 rounded-xl bg-muted/60 p-1 sm:w-[620px]">
          <TabsTrigger value="library" className="gap-2 py-2.5">
            <Library className="h-4 w-4" /> My الأفلام العربية
          </TabsTrigger>
          <TabsTrigger value="discover" className="gap-2 py-2.5">
            <Sparkles className="h-4 w-4" /> اكتشاف
          </TabsTrigger>
          <TabsTrigger value="releases" className="gap-2 py-2.5">
            <CalendarDays className="h-4 w-4" /> الإصدارات
          </TabsTrigger>
        </TabsList>

        <TabsContent value="library" className="mt-0">
          <CollectionWorldView world="arabic-movies" embedded />
        </TabsContent>
        <TabsContent value="discover" className="mt-0">
          <DiscoverView world="arabic-movies" embedded title="اكتشف أفلامًا عربية" subtitle="ابحث عن أفلام عربية جديدة وأضفها إلى مكتبتك" />
        </TabsContent>
        <TabsContent value="releases" className="mt-0">
          <ReleaseSchedule
            accentClass="text-emerald-400"
            originalLanguage="ar"
            language="ar"
            title="جدول إصدارات الأفلام العربية"
            subtitle="إصدارات الأفلام العربية خلال ستة أشهر، مع الحفاظ على التاريخ كما أعلن دون تغييره بسبب المنطقة الزمنية."
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}
