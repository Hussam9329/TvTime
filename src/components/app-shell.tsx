"use client";

import { useNav } from "@/lib/store";
import { Header } from "@/components/layout/header";
import { Footer } from "@/components/layout/footer";
import { HomeView } from "@/components/views/home-view";
import { DiscoverView } from "@/components/views/discover-view";
import { SearchView } from "@/components/views/search-view";
import { MovieDetailView } from "@/components/views/movie-detail-view";
import { TvDetailView } from "@/components/views/tv-detail-view";
import { PersonDetailView } from "@/components/views/person-detail-view";
import { CalendarView } from "@/components/views/calendar-view";
import { LibraryView } from "@/components/views/library-view";
import { StatsView } from "@/components/views/stats-view";
import { KeyboardShortcuts } from "@/components/layout/keyboard-shortcuts";
import { useEffect } from "react";

export function AppShell() {
  const view = useNav((s) => s.view);
  const movieId = useNav((s) => s.movieId);
  const tvId = useNav((s) => s.tvId);
  const personId = useNav((s) => s.personId);

  // Scroll to top on view change
  useEffect(() => {
    if (typeof window !== "undefined") window.scrollTo({ top: 0, behavior: "auto" });
  }, [view, movieId, tvId, personId]);

  return (
    <div className="min-h-screen flex flex-col">
      <Header />
      <KeyboardShortcuts />
      <main className="flex-1 max-w-[1400px] w-full mx-auto px-3 sm:px-4 lg:px-6 py-4 sm:py-6">
        <div key={`${view}-${movieId ?? ""}-${tvId ?? ""}-${personId ?? ""}`} className="animate-fade-in-up">
          {view === "home" && <HomeView />}
          {view === "discover" && <DiscoverView />}
          {view === "search" && <SearchView />}
          {view === "movie-detail" && <MovieDetailView />}
          {view === "tv-detail" && <TvDetailView />}
          {view === "person-detail" && <PersonDetailView />}
          {view === "calendar" && <CalendarView />}
          {view === "library" && <LibraryView />}
          {view === "stats" && <StatsView />}
        </div>
      </main>
      <Footer />
    </div>
  );
}
