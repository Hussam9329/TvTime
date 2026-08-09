"use client";

import { useState } from "react";
import { CalendarDays, Film, Grid2X2, Library, ListFilter, Sparkles, Tv } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { CollectionWorldView } from "@/components/views/collection-world-view";
import { DiscoverView } from "@/components/views/discover-view";
import { ReleaseSchedule } from "@/components/views/movie-release-schedule";
import { AnimeHubOverview } from "@/components/views/anime-hub-overview";
import { useAnimeHub } from "@/hooks/use-tmdb";

const ANIMATION_GENRES = [16];
type AnimeMediaType = "movie" | "tv";

export function AnimeView() {
  const [tab, setTab] = useState<"overview" | "library" | "discover" | "releases">("overview");
  const [mediaType, setMediaType] = useState<AnimeMediaType>("tv");
  const hub = useAnimeHub();
  const summary = hub.data?.summary;
  const summaryLine = `${summary?.titles ?? "…"} titles • ${summary?.inProgress ?? "…"} In Progress • ${summary?.episodesWatched ?? "…"} Episodes Watched`;

  const mediaSwitch = (
    <div className="tvtime-anime-media-switch mb-4 inline-flex rounded-xl border border-border/70 bg-card/75 p-1 shadow-sm" role="group" aria-label="Anime media type">
      <button type="button" aria-pressed={mediaType === "movie"} onClick={() => setMediaType("movie")} className={`flex min-h-9 items-center gap-1.5 rounded-lg px-3 text-sm font-semibold transition-colors ${mediaType === "movie" ? "bg-[var(--movie-world-accent)] text-black shadow-sm" : "text-muted-foreground hover:bg-accent"}`}><Film className="h-4 w-4" /> Movies</button>
      <button type="button" aria-pressed={mediaType === "tv"} onClick={() => setMediaType("tv")} className={`flex min-h-9 items-center gap-1.5 rounded-lg px-3 text-sm font-semibold transition-colors ${mediaType === "tv" ? "bg-[var(--movie-world-accent)] text-black shadow-sm" : "text-muted-foreground hover:bg-accent"}`}><Tv className="h-4 w-4" /> Series</button>
    </div>
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
          <ListFilter aria-hidden="true" /> Browse
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
            accentClass="text-fuchsia-400"
            title={`Anime ${mediaType === "movie" ? "Movie" : "Series"} Seasonal Calendar`}
            subtitle={`A Winter, Spring, Summer and Fall calendar for Japanese anime ${mediaType === "movie" ? "film" : "series"} premieres.`}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}
