"use client";

import { useMemo, useState } from "react";
import { AlertCircle, CalendarDays, ChevronLeft, ChevronRight, Film, Search, Tv } from "lucide-react";
import { useReleaseSchedule } from "@/hooks/use-tmdb";
import { dateOnlyFromLocalDate, formatDateOnly } from "@/lib/date-only";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { MediaCard, MediaGrid } from "@/components/media/media-card";
import { getTitle } from "@/lib/tmdb";

function rangeFromOffset(offset: number) {
  const now = new Date();
  const from = offset === 0
    ? new Date(now.getFullYear(), now.getMonth(), now.getDate(), 12)
    : new Date(now.getFullYear(), now.getMonth() + offset * 6, 1, 12);
  const to = new Date(from.getFullYear(), from.getMonth() + 6, from.getDate() - 1, 12);
  return { from: dateOnlyFromLocalDate(from), to: dateOnlyFromLocalDate(to) };
}

interface ReleaseScheduleProps {
  mediaType?: "movie" | "tv";
  /** Optional accent color override (default "primary"). Used to match the world's color. */
  accentClass?: string;
  /** Optional original-language filter (e.g. "ar" for Arabic-only, "en" for English-only). */
  originalLanguage?: string;
  /** Optional localized language for titles/posters (e.g. "ar" for Arabic UI). */
  language?: "ar" | "ja" | "en-US";
  /** Include or exclude TMDB genres before building the release schedule. */
  genres?: number[];
  withoutGenres?: number[];
  /** Exclude a separate language world, such as Arabic TV from standard TV. */
  excludedOriginalLanguage?: string;
  /** Header title override. */
  title?: string;
  /** Header subtitle override. */
  subtitle?: string;
}

/**
 * Shared title-premiere schedule for movies, TV shows, and anime.
 */
export function ReleaseSchedule({
  mediaType = "movie",
  accentClass = "text-primary",
  originalLanguage,
  language,
  genres,
  withoutGenres,
  excludedOriginalLanguage,
  title,
  subtitle,
}: ReleaseScheduleProps) {
  const [offset, setOffset] = useState(0);
  const [search, setSearch] = useState("");
  const range = useMemo(() => rangeFromOffset(offset), [offset]);
  const isTV = mediaType === "tv";
  const isRTL = language === "ar";
  const mediaLabel = isTV ? "TV show" : "movie";
  const resolvedTitle = title || (isTV ? "TV Release Schedule" : "Movie Release Schedule");
  const resolvedSubtitle = subtitle || `A six-month release agenda for upcoming ${isTV ? "shows" : "films"}. Dates are handled as date-only values and never shift with timezone conversion.`;
  const schedule = useReleaseSchedule(mediaType, range.from, range.to, {
    language,
    originalLanguage,
    excludedOriginalLanguage,
    genres,
    withoutGenres,
  });
  const items = useMemo(() => {
    const query = search.trim().toLowerCase();
    return (schedule.data?.items ?? []).filter((item) => !query || getTitle(item).toLowerCase().includes(query));
  }, [schedule.data?.items, search]);
  const groups = useMemo(() => {
    const map = new Map<string, typeof items>();
    for (const item of items) {
      const date = (isTV ? item.first_air_date : item.release_date) || "unknown";
      const group = map.get(date) ?? [];
      group.push(item);
      map.set(date, group);
    }
    return [...map.entries()].sort(([left], [right]) => left.localeCompare(right));
  }, [items, isTV]);

  return (
    <div
      className={`tvtime-release-schedule ${isRTL ? "tvtime-release-schedule--rtl" : ""} space-y-5`}
      dir={isRTL ? "rtl" : undefined}
      lang={isRTL ? "ar" : undefined}
    >
      <div data-ui-surface="panel" className="rounded-2xl border border-border/60 bg-gradient-to-br from-primary/10 via-card to-card p-4 sm:p-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h2 className="flex items-center gap-2 text-xl font-extrabold">
              <CalendarDays className={`h-5 w-5 ${accentClass}`} /> {resolvedTitle}
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">{resolvedSubtitle}</p>
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
        <MediaGrid items={[]} loading forcedMediaType={mediaType} />
      ) : schedule.isError ? (
        <Card className="feedback-state feedback-state--error p-12 text-center" role="alert">
          <AlertCircle className="mx-auto mb-3 h-10 w-10 text-rose-400" />
          <p className="font-semibold">Could not load the {mediaLabel} schedule</p>
          <p className="mt-1 text-sm text-muted-foreground">Your library is unaffected. TMDB may be temporarily unavailable.</p>
          <Button variant="outline" className="mt-4" onClick={() => schedule.refetch()}>Retry</Button>
        </Card>
      ) : groups.length === 0 ? (
        <Card className="feedback-state feedback-state--empty p-12 text-center text-muted-foreground" role="status">
          {isTV ? <Tv className="mx-auto mb-3 h-10 w-10 opacity-40" /> : <Film className="mx-auto mb-3 h-10 w-10 opacity-40" />}
          <p className="font-medium">No {mediaLabel} releases match this window</p>
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
                <CalendarDays className={`h-4 w-4 ${accentClass}`} />
                <h3 className="font-bold">{formatDateOnly(date) || "Release date unavailable"}</h3>
                <Badge variant="secondary">{releases.length}</Badge>
              </div>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
                {releases.map((release, index) => (
                  <MediaCard
                    key={release.id}
                    item={release}
                    index={index}
                    showMediaType={false}
                    forcedMediaType={mediaType}
                  />
                ))}
              </div>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
