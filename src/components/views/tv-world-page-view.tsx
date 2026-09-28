"use client";

import { useNav, type MovieHubTab } from "@/lib/store";
import { CalendarDays, Grid2X2, Library, ListFilter, Sparkles } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { TvShowsView } from "@/components/views/tv-tracking-view";
import { DiscoverView } from "@/components/views/discover-view";
import { ReleaseSchedule } from "@/components/views/movie-release-schedule";
import { TvHubOverview } from "@/components/views/tv-hub-overview";
import { useTvTrackingCounts } from "@/hooks/use-tmdb";
import { cn } from "@/lib/utils";

const ANIMATION_GENRES = [16];

type TrackingWorld = "standard" | "arabic" | "asian";
type DiscoverWorld = "tv" | "arabic-tv" | "asian-tv";

interface TvWorldPageViewProps {
  pageClassName: string;
  title: string;
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
  releaseCollectionWorld?: "standard-tv" | "arabic-tv" | "asian-tv";
  locale?: "en" | "ar";
}

/**
 * One structural shell for every TV catalogue. World classification stays in
 * the data hooks; this component only prevents visual and navigation drift.
 */
export function TvWorldPageView({
  pageClassName,
  title,
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
  // The active tab is remembered per world, the same way every movie world does it.
  const tab: MovieHubTab = useNav((state) => state.movieHubTabs[discoverWorld]) ?? "overview";
  const setMovieHubTab = useNav((state) => state.setMovieHubTab);
  const setTab = (next: MovieHubTab) => setMovieHubTab(discoverWorld, next);
  const isArabic = locale === "ar";
  const trackingCounts = useTvTrackingCounts(trackingWorld);
  const counts = trackingCounts.data?.counts;
  const eyebrow = isArabic ? "عالم مسلسلاتك العربية" : trackingWorld === "asian" ? "Your Asian TV world" : "Your TV world";
  const summary = isArabic
    ? `${counts?.all ?? "…"} في مكتبتك • ${counts?.watching ?? "…"} قيد المشاهدة • ${counts?.upcoming ?? "…"} قادم`
    : `${counts?.all ?? "…"} in Library • ${counts?.watching ?? "…"} Watching • ${counts?.upcoming ?? "…"} Upcoming`;

  return (
    <div
      className={cn("tvtime-world-view tvtime-tv-world-view tvtime-movie-hub tvtime-tv-hub", pageClassName)}
      data-tv-world={trackingWorld}
      dir={isArabic ? "rtl" : "ltr"}
      lang={isArabic ? "ar" : "en"}
    >
      <header className="tvtime-movie-hub__titlebar">
        <div className="min-w-0">
          <p className="tvtime-movie-hub__eyebrow">{eyebrow}</p>
          <h1>{title}</h1>
          <p className="tvtime-movie-hub__summary" aria-live="polite">{summary}</p>
        </div>
        <Button className="tvtime-movie-hub__browse" onClick={() => setTab("discover")}>
          <ListFilter aria-hidden="true" />
          {isArabic ? "تصفّح" : "Browse"}
        </Button>
      </header>

      <Tabs value={tab} onValueChange={(value) => setTab(value as MovieHubTab)} className="min-w-0">
        <TabsList className="tvtime-movie-hub__tabs">
          <TabsTrigger value="overview"><Grid2X2 /> {isArabic ? "نظرة عامة" : "Overview"}</TabsTrigger>
          <TabsTrigger value="library"><Library /> {isArabic ? "مكتبتي" : "My Library"}</TabsTrigger>
          <TabsTrigger value="discover"><Sparkles /> {isArabic ? "اكتشاف" : "Discover"}</TabsTrigger>
          <TabsTrigger value="releases"><CalendarDays /> {isArabic ? "الإصدارات" : "Releases"}</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="mt-0">
          <TvHubOverview world={trackingWorld} onBrowse={() => setTab("discover")} />
        </TabsContent>
        <TabsContent value="library" className="mt-0">
          <TvShowsView world={trackingWorld} embedded onDiscover={() => setTab("discover")} />
        </TabsContent>
        <TabsContent value="discover" className="mt-0">
          <DiscoverView
            world={discoverWorld}
            embedded
            title={discoverTitle ?? (trackingWorld === "asian" ? "Discover Asian TV Shows" : "Discover TV Shows")}
            subtitle={discoverSubtitle ?? "Choose what to see first, then refine the catalogue without visual clutter."}
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
