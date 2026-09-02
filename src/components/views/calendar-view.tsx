"use client";

import { useQuery } from "@tanstack/react-query";
import { CalendarDays, Clock3, RefreshCw, Tv2 } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useNav } from "@/lib/store";
import { userHeaders, withUserId } from "@/lib/client-user";

type CalendarItem = {
  tmdbId: number;
  title: string;
  poster: string | null;
  airDate: string;
  episodeName: string | null;
  season: number | null;
  episode: number | null;
  eventType: string;
};

export function CalendarView() {
  const goTv = useNav((state) => state.goTv);
  const query = useQuery({
    queryKey: ["tracked-calendar", 30],
    queryFn: async () => {
      const url = withUserId(new URL("/api/calendar/tracked?days=30", window.location.origin));
      const response = await fetch(url, { headers: userHeaders(), cache: "no-store" });
      if (!response.ok) throw new Error("Failed to load calendar");
      return response.json() as Promise<{ items: CalendarItem[]; trackedShows: number; awaitingMetadata: number }>;
    },
    staleTime: 5 * 60 * 1000,
  });

  const groups = new Map<string, CalendarItem[]>();
  for (const item of query.data?.items || []) {
    const bucket = groups.get(item.airDate) || [];
    bucket.push(item);
    groups.set(item.airDate, bucket);
  }

  return (
    <div className="space-y-5 py-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-primary">Upcoming</p>
          <h1 className="text-3xl font-black tracking-tight">Calendar</h1>
          <p className="mt-1 text-sm text-muted-foreground">The next 30 days for shows you actively follow.</p>
        </div>
        <Button variant="outline" size="sm" onClick={() => void query.refetch()} disabled={query.isFetching}>
          <RefreshCw className={`mr-1.5 h-4 w-4 ${query.isFetching ? "animate-spin" : ""}`} /> Refresh
        </Button>
      </div>

      {query.isError && <Card className="p-6 text-sm text-destructive">Calendar data could not be loaded.</Card>}
      {!query.isLoading && !query.isError && groups.size === 0 && (
        <Card className="p-8 text-center">
          <CalendarDays className="mx-auto h-10 w-10 text-muted-foreground" />
          <h2 className="mt-3 font-bold">No scheduled episodes in the next 30 days</h2>
          <p className="mt-1 text-sm text-muted-foreground">Tracked shows: {query.data?.trackedShows ?? 0}. Some shows may still be waiting for refreshed TMDB metadata.</p>
        </Card>
      )}

      <div className="space-y-4">
        {[...groups.entries()].map(([date, items]) => (
          <section key={date}>
            <div className="mb-2 flex items-center gap-2">
              <CalendarDays className="h-4 w-4 text-primary" />
              <h2 className="font-bold">{new Date(`${date}T12:00:00`).toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" })}</h2>
            </div>
            <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-3">
              {items.map((item) => (
                <button key={`${item.tmdbId}-${item.airDate}`} type="button" onClick={() => goTv(item.tmdbId)} className="text-left">
                  <Card className="h-full p-4 transition-colors hover:bg-accent/50">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="truncate font-bold">{item.title}</p>
                        <p className="mt-1 text-xs font-semibold text-primary">{item.eventType}</p>
                        <p className="mt-1 text-sm text-muted-foreground">{item.season != null && item.episode != null ? `S${item.season} · E${item.episode}` : "Episode date announced"}{item.episodeName ? ` — ${item.episodeName}` : ""}</p>
                      </div>
                      <Tv2 className="h-5 w-5 shrink-0 text-muted-foreground" />
                    </div>
                    <p className="mt-3 flex items-center gap-1.5 text-xs text-muted-foreground"><Clock3 className="h-3.5 w-3.5" /> TMDB air date</p>
                  </Card>
                </button>
              ))}
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}
