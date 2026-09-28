"use client";

import { useState } from "react";
import { CalendarDays, Film, Grid2X2, Library, ListFilter, Sparkles, Tv } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { CollectionWorldView } from "@/components/views/collection-world-view";
import { DiscoverView } from "@/components/views/discover-view";
import { ReleaseSchedule } from "@/components/views/movie-release-schedule";
import { AnimeHubOverview } from "@/components/views/anime-hub-overview";
import { useAnimeHub } from "@/hooks/use-tmdb";

const ANIMATION_GENRES = [16];
type AnimeMediaType = "movie" | "tv";
const ANIME_SWITCH_ITEM_CLASS =
  "flex-none gap-1.5 rounded-xl px-3 text-sm font-semibold text-muted-foreground first:rounded-xl last:rounded-xl hover:bg-accent hover:text-accent-foreground data-[state=on]:bg-[var(--movie-world-accent)] data-[state=on]:text-primary-foreground data-[state=on]:shadow-sm";

export function AnimeView() {
  const [tab, setTab] = useState<"overview" | "library" | "discover" | "releases">("overview");
  const [mediaType, setMediaType] = useState<AnimeMediaType>("tv");
  const hub = useAnimeHub();
  const summary = hub.data?.summary;
  const summaryLine = `${summary?.titles ?? "…"} titles • ${summary?.inProgress ?? "…"} In Progress • ${summary?.episodesWatched ?? "…"} Episodes Watched`;

  const mediaSwitch = (
    <ToggleGroup
      type="single"
      size="lg"
      value={mediaType}
      onValueChange={(value) => {
        if (value === "movie" || value === "tv") setMediaType(value);
      }}
      className="tvtime-anime-media-switch mb-4 inline-flex gap-1 rounded-xl border border-border/70 bg-card/75 p-1 shadow-sm"
      aria-label="Anime media type"
    >
      <ToggleGroupItem value="movie" className={ANIME_SWITCH_ITEM_CLASS}>
        <Film aria-hidden="true" /> Movies
      </ToggleGroupItem>
      <ToggleGroupItem value="tv" className={ANIME_SWITCH_ITEM_CLASS}>
        <Tv aria-hidden="true" /> Series
      </ToggleGroupItem>
    </ToggleGroup>
  );

  return (
    <div className="tvtime-world-view tvtime-anime-view tvtime-movie-hub" data-world="anime">
      <header className="tvtime-movie-hub__titlebar">
        <div className="min-w-0">
          <p className="tvtime-movie-hub__eyebrow">Your Anime world</p>
          <h1>Anime</h1>
          <p className="tvtime-movie-hub__summary" aria-live="polite">{summaryLine}</p>
        </div>
        <Button className="tvtime-movie-hub__browse" onClick={() => setTab("discover")}>
          <ListFilter aria-hidden="true" />
          Browse
        </Button>
      </header>

      <Tabs value={tab} onValueChange={(value) => setTab(value as typeof tab)} className="min-w-0">
        <TabsList className="tvtime-movie-hub__tabs">
          <TabsTrigger value="overview"><Grid2X2 /> Overview</TabsTrigger>
          <TabsTrigger value="library"><Library /> My Library</TabsTrigger>
          <TabsTrigger value="discover"><Sparkles /> Discover</TabsTrigger>
          <TabsTrigger value="releases"><CalendarDays /> Releases</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="mt-0">
          <AnimeHubOverview onBrowse={() => setTab("discover")} />
        </TabsContent>
        <TabsContent value="library" className="mt-0">
          <CollectionWorldView world="anime" embedded onDiscover={() => setTab("discover")} />
        </TabsContent>
        <TabsContent value="discover" className="mt-0">
          {mediaSwitch}
          <DiscoverView
            world="anime"
            embedded
            mediaType={mediaType}
            title={`Discover Anime ${mediaType === "movie" ? "Movies" : "Series"}`}
            subtitle={`Browse Japanese animation ${mediaType === "movie" ? "films" : "shows"} without mixing in live-action titles.`}
          />
        </TabsContent>
        <TabsContent value="releases" className="mt-0">
          {mediaSwitch}
          <ReleaseSchedule
            mediaType={mediaType}
            genres={ANIMATION_GENRES}
            originalLanguage="ja"
            language="en-US"
            collectionWorld="anime"
            seasonal
            accentClass="text-chart-2"
            title={`Anime ${mediaType === "movie" ? "Movie" : "Series"} Seasonal Calendar`}
            subtitle={`A Winter, Spring, Summer and Fall calendar for Japanese anime ${mediaType === "movie" ? "film" : "series"} premieres.`}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}
