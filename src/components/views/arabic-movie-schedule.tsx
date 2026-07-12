"use client";

import { useMemo, useState } from "react";
import { AlertCircle, CalendarDays, ChevronLeft, ChevronRight, Film, Search } from "lucide-react";
import { useArabicMovieSchedule } from "@/hooks/use-tmdb";
import { dateOnlyFromLocalDate, formatDateOnly } from "@/lib/date-only";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { SafeImage } from "@/components/media/safe-image";
import { imgOrPlaceholder, getTitle } from "@/lib/tmdb";
import { useNav } from "@/lib/store";

function rangeFromOffset(offset: number) {
  const now = new Date();
  const from = offset === 0
    ? new Date(now.getFullYear(), now.getMonth(), now.getDate(), 12)
    : new Date(now.getFullYear(), now.getMonth() + offset * 6, 1, 12);
  const to = new Date(from.getFullYear(), from.getMonth() + 6, from.getDate() - 1, 12);
  return { from: dateOnlyFromLocalDate(from), to: dateOnlyFromLocalDate(to) };
}

export function ArabicMovieReleaseSchedule() {
  const [offset, setOffset] = useState(0);
  const [search, setSearch] = useState("");
  const goMovie = useNav((state) => state.goMovie);
  const range = useMemo(() => rangeFromOffset(offset), [offset]);
  const schedule = useArabicMovieSchedule(range.from, range.to);
  const items = useMemo(() => {
    const query = search.trim().toLowerCase();
    return (schedule.data?.items ?? []).filter((item) => !query || getTitle(item).toLowerCase().includes(query));
  }, [schedule.data?.items, search]);
  const groups = useMemo(() => {
    const map = new Map<string, typeof items>();
    for (const item of items) {
      const date = item.release_date || "unknown";
      const group = map.get(date) ?? [];
      group.push(item);
      map.set(date, group);
    }
    return [...map.entries()].sort(([left], [right]) => left.localeCompare(right));
  }, [items]);

  return (
    <div className="space-y-5">
      <div className="rounded-2xl border border-emerald-500/20 bg-gradient-to-br from-emerald-500/10 via-card to-card p-4 sm:p-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h2 className="flex items-center gap-2 text-xl font-extrabold">
              <CalendarDays className="h-5 w-5 text-emerald-400" /> Arabic Movie Release Schedule
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              A dedicated six-month release agenda for Arabic-language films. Dates are handled as date-only values and never shift with timezone conversion.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => setOffset((value) => value - 1)}>
              <ChevronLeft className="mr-1 h-4 w-4" /> Earlier
            </Button>
            <Button variant="outline" size="sm" disabled={offset === 0} onClick={() => setOffset(0)}>Current window</Button>
            <Button variant="outline" size="sm" onClick={() => setOffset((value) => value + 1)}>
              Later <ChevronRight className="ml-1 h-4 w-4" />
            </Button>
          </div>
        </div>
        <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <Badge variant="secondary" className="w-fit px-3 py-1">
            {formatDateOnly(range.from, { day: "numeric", month: "short", year: "numeric" })} – {formatDateOnly(range.to, { day: "numeric", month: "short", year: "numeric" })}
          </Badge>
          <div className="relative w-full sm:max-w-sm">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search this release schedule..." className="pl-9" />
          </div>
        </div>
      </div>

      {schedule.isLoading ? (
        <div className="space-y-3">{Array.from({ length: 6 }).map((_, index) => <div key={index} className="h-28 shimmer rounded-xl" />)}</div>
      ) : schedule.isError ? (
        <Card className="p-12 text-center">
          <AlertCircle className="mx-auto mb-3 h-10 w-10 text-rose-400" />
          <p className="font-semibold">Could not load the Arabic movie schedule</p>
          <p className="mt-1 text-sm text-muted-foreground">Your library is unaffected. TMDB may be temporarily unavailable.</p>
          <Button variant="outline" className="mt-4" onClick={() => schedule.refetch()}>Retry</Button>
        </Card>
      ) : groups.length === 0 ? (
        <Card className="p-12 text-center text-muted-foreground">
          <Film className="mx-auto mb-3 h-10 w-10 opacity-40" />
          <p className="font-medium">No Arabic movie releases match this window</p>
          {search && <Button variant="outline" size="sm" className="mt-4" onClick={() => setSearch("")}>Clear search</Button>}
        </Card>
      ) : (
        <div className="space-y-4">
          <div className="flex items-center justify-between gap-3 text-sm text-muted-foreground">
            <span><strong className="text-foreground">{items.length}</strong> scheduled releases</span>
            {schedule.data?.truncated && <span>Showing the first {schedule.data.pagesFetched} TMDB pages for this window.</span>}
          </div>
          {groups.map(([date, releases]) => (
            <section key={date} className="space-y-2">
              <div className="sticky top-16 z-10 flex items-center gap-2 bg-background/90 py-2 backdrop-blur">
                <CalendarDays className="h-4 w-4 text-emerald-400" />
                <h3 className="font-bold">{formatDateOnly(date) || "Release date unavailable"}</h3>
                <Badge variant="secondary">{releases.length}</Badge>
              </div>
              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                {releases.map((movie) => (
                  <button key={movie.id} onClick={() => goMovie(movie.id)} className="text-left">
                    <Card className="flex gap-3 p-3 transition-all hover:border-emerald-500/40 hover:shadow-lg hover:shadow-emerald-500/5">
                      <div className="h-24 w-16 flex-shrink-0 overflow-hidden rounded-md bg-muted">
                        <SafeImage src={imgOrPlaceholder(movie.poster_path, "w185")} alt={getTitle(movie)} className="h-full w-full object-cover" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="mb-1 flex flex-wrap gap-1.5">
                          <Badge className="border-0 bg-emerald-500/20 text-emerald-300">Arabic Movie</Badge>
                          {movie.vote_average > 0 && <Badge variant="secondary">{movie.vote_average.toFixed(1)}/10</Badge>}
                        </div>
                        <h4 className="line-clamp-2 font-semibold">{getTitle(movie)}</h4>
                        <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">{movie.overview || "No overview available."}</p>
                      </div>
                    </Card>
                  </button>
                ))}
              </div>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
