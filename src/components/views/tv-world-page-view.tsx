"use client";

import { useState, type ComponentType } from "react";
import { CalendarDays, Library, Sparkles } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { TvShowsView } from "@/components/views/tv-tracking-view";
import { DiscoverView } from "@/components/views/discover-view";
import { ReleaseSchedule } from "@/components/views/movie-release-schedule";
import { cn } from "@/lib/utils";

const ANIMATION_GENRES = [16];

type TrackingWorld = "standard" | "arabic" | "asian";
type DiscoverWorld = "tv" | "arabic-tv" | "asian-tv";

interface TvWorldPageViewProps {
  pageClassName: string;
  icon: ComponentType<{ className?: string }>;
  iconClassName: string;
  heroClassName: string;
  title: string;
  description: string;
  trackingWorld: TrackingWorld;
  discoverWorld: DiscoverWorld;
  discoverTitle?: string;
  discoverSubtitle?: string;
  releaseTitle: string;
  releaseSubtitle: string;
  releaseAccentClass?: string;
  releaseOriginalLanguage?: string;
  releaseLanguage?: "ar" | "ja" | "en-US";
  releaseExcludedOriginalLanguage?: string;
  releaseCollectionWorld?: "standard-tv" | "asian-tv";
  locale?: "en" | "ar";
}

/**
 * One structural shell for every TV catalogue. World classification stays in
 * the data hooks; this component only prevents visual and navigation drift.
 */
export function TvWorldPageView({
  pageClassName,
  icon: Icon,
  iconClassName,
  heroClassName,
  title,
  description,
  trackingWorld,
  discoverWorld,
  discoverTitle,
  discoverSubtitle,
  releaseTitle,
  releaseSubtitle,
  releaseAccentClass,
  releaseOriginalLanguage,
  releaseLanguage,
  releaseExcludedOriginalLanguage,
  releaseCollectionWorld,
  locale = "en",
}: TvWorldPageViewProps) {
  const [tab, setTab] = useState<"library" | "discover" | "releases">("library");
  const isArabic = locale === "ar";

  return (
    <div
      className={cn("tvtime-world-view tvtime-tv-world-view space-y-5", pageClassName)}
      dir={isArabic ? "rtl" : undefined}
      lang={isArabic ? "ar" : undefined}
    >
      <section
        data-ui-surface="hero"
        className={cn("tvtime-page-hero rounded-2xl border bg-gradient-to-br via-card to-card p-4 sm:p-5", heroClassName)}
      >
        <div className="view-page-header flex items-start gap-3">
          <Icon className={cn("mt-0.5 h-5 w-5 shrink-0", iconClassName)} />
          <div className="min-w-0">
            <h1 className="view-page-title text-xl font-extrabold tracking-tight">{title}</h1>
            <p className="view-page-description mt-1 text-sm text-muted-foreground">{description}</p>
          </div>
        </div>
      </section>

      <Tabs value={tab} onValueChange={(value) => setTab(value as typeof tab)} className="space-y-5">
        <TabsList className="tvtime-world-tabs grid h-auto w-full grid-cols-3 gap-1 rounded-xl bg-muted/60 p-1 sm:w-[620px]">
          <TabsTrigger value="library" className="gap-2 py-2.5">
            <Library className="h-4 w-4" /> {isArabic ? "مكتبتي" : "My Library"}
          </TabsTrigger>
          <TabsTrigger value="discover" className="gap-2 py-2.5">
            <Sparkles className="h-4 w-4" /> {isArabic ? "اكتشاف" : "Discover"}
          </TabsTrigger>
          <TabsTrigger value="releases" className="gap-2 py-2.5">
            <CalendarDays className="h-4 w-4" /> {isArabic ? "الإصدارات" : "Releases"}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="library" className="mt-0">
          <TvShowsView world={trackingWorld} embedded />
        </TabsContent>
        <TabsContent value="discover" className="mt-0">
          <DiscoverView
            world={discoverWorld}
            embedded
            title={discoverTitle}
            subtitle={discoverSubtitle}
          />
        </TabsContent>
        <TabsContent value="releases" className="mt-0">
          <ReleaseSchedule
            mediaType="tv"
            withoutGenres={ANIMATION_GENRES}
            originalLanguage={releaseOriginalLanguage}
            language={releaseLanguage}
            excludedOriginalLanguage={releaseExcludedOriginalLanguage}
            collectionWorld={releaseCollectionWorld}
            accentClass={releaseAccentClass}
            title={releaseTitle}
            subtitle={releaseSubtitle}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}
