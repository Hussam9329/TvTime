"use client";

import { useEffect } from "react";
import { useAppStore } from "@/lib/store";
import { AppShell } from "@/components/app-shell";
import { HomeView } from "@/components/home-view";
import { SearchView } from "@/components/search-view";
import { StatsView } from "@/components/stats-view";
import { LibrarySection } from "@/components/library-section";
import {
  discoverMovies,
  discoverTV,
  discoverAnime,
  discoverArabicMovies,
  discoverArabicTV,
  allMedia,
} from "@/lib/mock-data";
import type { MediaType } from "@/lib/types";

export default function Home() {
  const { currentView, media, theme } = useAppStore();

  // Apply theme to document
  useEffect(() => {
    if (theme === "dark") {
      document.documentElement.classList.add("dark");
    } else {
      document.documentElement.classList.remove("dark");
    }
  }, [theme]);

  // Build upcoming items for each section from store media
  const buildUpcoming = (type: MediaType) => {
    return media
      .filter((m) => m.mediaType === type && m.nextEpisode)
      .map((m) => ({
        date: m.nextEpisode!.airDate,
        media: m,
        season: m.nextEpisode!.season,
        episode: m.nextEpisode!.episode,
        name: m.nextEpisode!.name,
      }))
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  };

  // For movies: use releaseDate as upcoming
  const buildMovieUpcoming = (type: MediaType) => {
    return allMedia
      .filter((m) => m.mediaType === type && m.releaseDate)
      .map((m) => ({
        date: m.releaseDate!,
        media: m,
      }))
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
      .slice(0, 30);
  };

  const renderView = () => {
    switch (currentView) {
      case "home":
        return <HomeView />;
      case "search":
        return <SearchView />;
      case "stats":
        return <StatsView />;
      case "movies":
        return (
          <LibrarySection
            config={{
              mediaType: "movie",
              title: "Movies",
              arabicTitle: "أفلام",
              hasSchedule: true,
              scheduleLabel: "إصدارات قادمة",
              discoverItems: discoverMovies,
              upcomingItems: buildMovieUpcoming("movie"),
            }}
          />
        );
      case "tvshows":
        return (
          <LibrarySection
            config={{
              mediaType: "tv",
              title: "TV Shows",
              arabicTitle: "مسلسلات",
              hasSchedule: true,
              scheduleLabel: "جدول الحلقات",
              discoverItems: discoverTV,
              upcomingItems: buildUpcoming("tv"),
            }}
          />
        );
      case "anime":
        return (
          <LibrarySection
            config={{
              mediaType: "anime",
              title: "Anime",
              arabicTitle: "أنمي",
              hasSchedule: true,
              scheduleLabel: "جدول الحلقات",
              discoverItems: discoverAnime,
              upcomingItems: buildUpcoming("anime"),
            }}
          />
        );
      case "arabic_movies":
        return (
          <LibrarySection
            config={{
              mediaType: "arabic_movie",
              title: "Arabic Movies",
              arabicTitle: "أفلام عربية",
              hasSchedule: true,
              scheduleLabel: "إصدارات قادمة",
              discoverItems: discoverArabicMovies,
              upcomingItems: buildMovieUpcoming("arabic_movie"),
            }}
          />
        );
      case "arabic_tv":
        return (
          <LibrarySection
            config={{
              mediaType: "arabic_tv",
              title: "Arabic TV",
              arabicTitle: "مسلسلات عربية",
              hasSchedule: true,
              scheduleLabel: "جدول الحلقات",
              discoverItems: discoverArabicTV,
              upcomingItems: buildUpcoming("arabic_tv"),
            }}
          />
        );
      default:
        return <HomeView />;
    }
  };

  return (
    <AppShell>{renderView()}</AppShell>
  );
}
