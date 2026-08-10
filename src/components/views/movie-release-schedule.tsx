"use client";

import { useMemo, useState } from "react";
import { AlertCircle, CalendarDays, ChevronLeft, ChevronRight, Film, Search, Tv } from "lucide-react";
import { useMediaStates, useReleaseSchedule } from "@/hooks/use-tmdb";
import { dateOnlyFromLocalDate, formatDateOnly } from "@/lib/date-only";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { MediaGrid } from "@/components/media/media-card";
import { getTitle } from "@/lib/tmdb";
import { ASIAN_ORIGIN_COUNTRY_QUERY } from "@/lib/asian-media";
import { filterAndPrioritizeMediaCollectionWorldItems } from "@/lib/media-world-pipeline";
import type { MediaCollectionWorld } from "@/lib/media-world-classification";

function rangeFromOffset(offset: number, seasonal = false) {
  const now = new Date();
  if (seasonal) {
    const currentQuarterMonth = Math.floor(now.getMonth() / 3) * 3;
    const from = new Date(now.getFullYear(), currentQuarterMonth + offset * 3, 1, 12);
    const to = new Date(from.getFullYear(), from.getMonth() + 3, 0, 12);
    return { from: dateOnlyFromLocalDate(from), to: dateOnlyFromLocalDate(to) };
  }
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
  collectionWorld?: MediaCollectionWorld;
  /** Align navigation to calendar quarters. Used by Anime for Winter/Spring/Summer/Fall seasons. */
  seasonal?: boolean;
}

function seasonLabel(date: string) {
  const parsed = new Date(`${date}T12:00:00`);
  const season = ["Winter", "Spring", "Summer", "Fall"][Math.floor(parsed.getMonth() / 3)];
  return `${season} ${parsed.getFullYear()}`;
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
  collectionWorld,
  seasonal = false,
}: ReleaseScheduleProps) {
  const [offset, setOffset] = useState(0);
  const [search, setSearch] = useState("");
  const range = useMemo(() => rangeFromOffset(offset, seasonal), [offset, seasonal]);
  const isTV = mediaType === "tv";
  const isRTL = language === "ar";
  const mediaLabel = isRTL ? (isTV ? "المسلسلات" : "الأفلام") : (isTV ? "TV show" : "movie");
  const resolvedTitle = title || (isTV ? "TV Release Schedule" : "Movie Release Schedule");
  const resolvedSubtitle = subtitle || `A six-month release agenda for upcoming ${isTV ? "shows" : "films"}. Dates are handled as date-only values and never shift with timezone conversion.`;
  const previousWindowLabel = isRTL ? "أقدم" : seasonal ? "Previous season" : "Earlier";
  const currentWindowLabel = isRTL ? "الفترة الحالية" : seasonal ? "Current season" : "Current window";
  const nextWindowLabel = isRTL ? "أحدث" : seasonal ? "Next season" : "Later";
  const schedule = useReleaseSchedule(mediaType, range.from, range.to, {
    collectionWorld,
    language,
    originalLanguage,
    excludedOriginalLanguage,
    genres,
    withoutGenres,
    originCountries: collectionWorld === "asian-movies" || collectionWorld === "asian-tv" ? ASIAN_ORIGIN_COUNTRY_QUERY : undefined,
  });
  const items = useMemo(() => {
    const query = search.trim().toLowerCase();
    const matchingSearch = (schedule.data?.items ?? [])
      .filter((item) => !query || getTitle(item).toLowerCase().includes(query));
    return collectionWorld
      ? filterAndPrioritizeMediaCollectionWorldItems(matchingSearch, collectionWorld)
      : matchingSearch;
  }, [collectionWorld, schedule.data?.items, search]);
  const releaseLibraryStates = useMediaStates(items.map((item) => ({
    tmdbId: Number(item.id),
    mediaType,
  })), {
    enabled: !schedule.isLoading && !schedule.isError && items.length > 0,
  });
  const groups = useMemo(() => {
    const map = new Map<string, typeof items>();
    for (const item of items) {
      const date = (isTV ? item.first_air_date : item.release_date) || "unknown";
      const group = map.get(date) ?? [];
      group.push(item);
      map.set(date, group);
    }
    // Preserve the central world's primary country order. The API's
    // chronological/title order remains stable inside each priority group.
    return [...map.entries()];
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
          <div className="tvtime-release-schedule__window-controls flex items-center gap-2">
            <Button className="tvtime-release-schedule__window-button" variant="outline" size="sm" aria-label={previousWindowLabel} onClick={() => setOffset((value) => value - 1)}>
              <ChevronLeft className="tvtime-release-schedule__window-icon h-4 w-4" aria-hidden="true" />
              <span className="tvtime-release-schedule__window-label tvtime-release-schedule__window-label--full">{previousWindowLabel}</span>
              <span className="tvtime-release-schedule__window-label tvtime-release-schedule__window-label--compact" aria-hidden="true">{isRTL ? "سابق" : "Prev"}</span>
            </Button>
            <Button className="tvtime-release-schedule__window-button" variant="outline" size="sm" aria-label={currentWindowLabel} disabled={offset === 0} onClick={() => setOffset(0)}>
              <span className="tvtime-release-schedule__window-label tvtime-release-schedule__window-label--full">{currentWindowLabel}</span>
              <span className="tvtime-release-schedule__window-label tvtime-release-schedule__window-label--compact" aria-hidden="true">{isRTL ? "الآن" : "Now"}</span>
            </Button>
            <Button className="tvtime-release-schedule__window-button" variant="outline" size="sm" aria-label={nextWindowLabel} onClick={() => setOffset((value) => value + 1)}>
              <span className="tvtime-release-schedule__window-label tvtime-release-schedule__window-label--full">{nextWindowLabel}</span>
              <span className="tvtime-release-schedule__window-label tvtime-release-schedule__window-label--compact" aria-hidden="true">{isRTL ? "تالي" : "Next"}</span>
              <ChevronRight className="tvtime-release-schedule__window-icon h-4 w-4" aria-hidden="true" />
            </Button>
          </div>
        </div>
        <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <Badge variant="secondary" className="tvtime-release-schedule__range w-fit px-3 py-1">
            {seasonal && <span className="mr-1 font-bold text-foreground">{seasonLabel(range.from)} ·</span>}
            {formatDateOnly(range.from, { day: "numeric", month: "short", year: "numeric" }, isRTL ? "ar-IQ" : "en-US")} – {formatDateOnly(range.to, { day: "numeric", month: "short", year: "numeric" }, isRTL ? "ar-IQ" : "en-US")}
          </Badge>
          <div className="relative w-full sm:max-w-sm">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input value={search} onChange={(event) => setSearch(event.target.value)} placeholder={isRTL ? "ابحث في جدول الإصدارات..." : "Search this release schedule..."} className="pl-9" />
          </div>
        </div>
      </div>

      {schedule.isLoading ? (
        <MediaGrid items={[]} loading forcedMediaType={mediaType} presentation="home" />
      ) : schedule.isError ? (
        <Card className="feedback-state feedback-state--error p-12 text-center" role="alert">
          <AlertCircle className="mx-auto mb-3 h-10 w-10 text-rose-400" />
          <p className="font-semibold">{isRTL ? `تعذر تحميل جدول ${mediaLabel}` : `Could not load the ${mediaLabel} schedule`}</p>
          <p className="mt-1 text-sm text-muted-foreground">{isRTL ? "مكتبتك لم تتأثر. قد تكون خدمة TMDB غير متاحة مؤقتاً." : "Your library is unaffected. TMDB may be temporarily unavailable."}</p>
          <Button variant="outline" className="mt-4" onClick={() => schedule.refetch()}>{isRTL ? "إعادة المحاولة" : "Retry"}</Button>
        </Card>
      ) : groups.length === 0 ? (
        <Card className="feedback-state feedback-state--empty p-12 text-center text-muted-foreground" role="status">
          {isTV ? <Tv className="mx-auto mb-3 h-10 w-10 opacity-40" /> : <Film className="mx-auto mb-3 h-10 w-10 opacity-40" />}
          <p className="font-medium">{isRTL ? `لا توجد إصدارات ضمن ${mediaLabel} في هذه الفترة` : `No ${mediaLabel} releases match this window`}</p>
          {search && <Button variant="outline" size="sm" className="mt-4" onClick={() => setSearch("")}>{isRTL ? "مسح البحث" : "Clear search"}</Button>}
        </Card>
      ) : (
        <div className="space-y-4">
          <div className="tvtime-release-schedule__summary flex items-center justify-between gap-3 text-sm text-muted-foreground">
            <span><strong className="text-foreground">{items.length}</strong> {isRTL ? "إصداراً مجدولاً" : "scheduled releases"}</span>
            {schedule.data?.truncated && <span>{isRTL ? `تُعرض أول ${schedule.data.pagesFetched} صفحات من TMDB لهذه الفترة.` : `Showing the first ${schedule.data.pagesFetched} TMDB pages for this window.`}</span>}
          </div>
          {groups.map(([date, releases]) => (
            <section key={date} className="space-y-2">
              <div className="tvtime-release-schedule__date-heading sticky top-16 z-10 flex items-center gap-2 bg-background/90 py-2 backdrop-blur">
                <CalendarDays className={`h-4 w-4 ${accentClass}`} />
                <h3 className="font-bold">{formatDateOnly(date, undefined, isRTL ? "ar-IQ" : "en-US") || (isRTL ? "تاريخ الإصدار غير متاح" : "Release date unavailable")}</h3>
                <Badge variant="secondary">{releases.length}</Badge>
              </div>
              <MediaGrid
                items={releases}
                forcedMediaType={mediaType}
                libraryStates={releaseLibraryStates.data}
                libraryStatesReady={releaseLibraryStates.isSuccess}
                presentation="home"
                priorityCount={0}
              />
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
