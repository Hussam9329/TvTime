"use client";

import {
  useCalendarSchedule,
  useEpisodeToggle,
  useBulkEpisodeToggle,
  useEpisodeWatchTimeline,
  type CalendarScheduleEpisode,
} from "@/hooks/use-tmdb";
import { useNav } from "@/lib/store";
import { img, imgOrPlaceholder } from "@/lib/tmdb";
import {
  addDaysToDateOnly,
  dateOnlyFromLocalDate,
  dateOnlyToLocalDate,
  formatDateOnly,
} from "@/lib/date-only";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  CalendarDays,
  Tv,
  ChevronLeft,
  ChevronRight,
  Bell,
  AlertCircle,
  Search,
  CheckCircle2,
  Circle,
  Clock3,
  Play,
  ExternalLink,
  Sparkles,
  ListFilter,
  RotateCcw,
  CalendarClock,
  Eye,
  EyeOff,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { EpisodeWatchConfirmationDialog } from "@/components/media/episode-watch-confirmation-dialog";
import {
  buildEpisodeWatchPlan,
  type EpisodeWatchPlan,
} from "@/lib/episode-watch-plan";

type CalendarMode = "month" | "week" | "agenda";
type CalendarFilter = "all" | "upcoming" | "aired" | "unwatched" | "watched" | "tv" | "anime";

const WEEKDAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const FILTERS: Array<{ value: CalendarFilter; label: string }> = [
  { value: "all", label: "All" },
  { value: "upcoming", label: "Upcoming" },
  { value: "aired", label: "Aired" },
  { value: "unwatched", label: "Unwatched" },
  { value: "watched", label: "Watched" },
  { value: "tv", label: "TV Shows" },
  { value: "anime", label: "Anime" },
];

function startOfWeek(date: Date) {
  const result = new Date(date.getFullYear(), date.getMonth(), date.getDate(), 12);
  result.setDate(result.getDate() - result.getDay());
  return result;
}

function rangeFor(mode: CalendarMode, cursor: Date) {
  if (mode === "week") {
    const start = startOfWeek(cursor);
    const end = new Date(start);
    end.setDate(start.getDate() + 6);
    return { from: dateOnlyFromLocalDate(start), to: dateOnlyFromLocalDate(end) };
  }

  const first = new Date(cursor.getFullYear(), cursor.getMonth(), 1, 12);
  const last = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 0, 12);
  return { from: dateOnlyFromLocalDate(first), to: dateOnlyFromLocalDate(last) };
}

function monthCells(cursor: Date) {
  const year = cursor.getFullYear();
  const month = cursor.getMonth();
  const first = new Date(year, month, 1, 12);
  const total = new Date(year, month + 1, 0, 12).getDate();
  const cells: Array<string | null> = [];
  for (let index = 0; index < first.getDay(); index += 1) cells.push(null);
  for (let day = 1; day <= total; day += 1) {
    cells.push(dateOnlyFromLocalDate(new Date(year, month, day, 12)));
  }
  while (cells.length % 7 !== 0) cells.push(null);
  return cells;
}

function weekCells(cursor: Date) {
  const start = startOfWeek(cursor);
  return Array.from({ length: 7 }, (_, index) => {
    const day = new Date(start);
    day.setDate(start.getDate() + index);
    return dateOnlyFromLocalDate(day);
  });
}

function relativeDateLabel(dateKey: string, todayKey: string) {
  if (dateKey === todayKey) return "Today";
  if (dateKey === addDaysToDateOnly(todayKey, 1)) return "Tomorrow";
  if (dateKey === addDaysToDateOnly(todayKey, -1)) return "Yesterday";
  return formatDateOnly(dateKey, { weekday: "long", month: "long", day: "numeric" }) || dateKey;
}

function rangeTitle(mode: CalendarMode, cursor: Date) {
  if (mode === "week") {
    const days = weekCells(cursor);
    const first = formatDateOnly(days[0], { month: "short", day: "numeric" });
    const last = formatDateOnly(days[6], { month: "short", day: "numeric", year: "numeric" });
    return `${first} – ${last}`;
  }
  return cursor.toLocaleDateString("en-US", { month: "long", year: "numeric" });
}

function isVisibleByFilter(episode: CalendarScheduleEpisode, filter: CalendarFilter, todayKey: string) {
  switch (filter) {
    case "upcoming": return episode.date > todayKey;
    case "aired": return episode.date <= todayKey;
    case "unwatched": return !episode.watched && episode.date <= todayKey;
    case "watched": return episode.watched;
    case "tv": return !episode.isAnime;
    case "anime": return episode.isAnime;
    default: return true;
  }
}

export function CalendarView({ world = "general", embedded = false }: { world?: "general" | "arabic-tv"; embedded?: boolean }) {
  const { goTv, setView } = useNav();
  const [cursor, setCursor] = useState(() => {
    const today = new Date();
    return new Date(today.getFullYear(), today.getMonth(), today.getDate(), 12);
  });
  const [mode, setMode] = useState<CalendarMode>("month");
  const [filter, setFilter] = useState<CalendarFilter>("all");
  const [search, setSearch] = useState("");
  const [selectedEpisode, setSelectedEpisode] = useState<CalendarScheduleEpisode | null>(null);
  const [selectedDay, setSelectedDay] = useState<string | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const mobile = window.matchMedia("(max-width: 639px)");
    const frame = window.requestAnimationFrame(() => {
      if (mobile.matches) setMode((current) => current === "month" ? "agenda" : current);
    });
    return () => window.cancelAnimationFrame(frame);
  }, []);

  const todayKey = dateOnlyFromLocalDate(new Date());
  const range = useMemo(() => rangeFor(mode, cursor), [mode, cursor]);
  const schedule = useCalendarSchedule(range.from, range.to, world);
  const allEpisodes = schedule.data?.episodes ?? [];
  const normalizedSearch = search.trim().toLocaleLowerCase();

  const episodes = useMemo(() => allEpisodes.filter((episode) => {
    if (!isVisibleByFilter(episode, filter, todayKey)) return false;
    if (!normalizedSearch) return true;
    return `${episode.showTitle} ${episode.episodeName} S${episode.seasonNumber}E${episode.episodeNumber}`
      .toLocaleLowerCase()
      .includes(normalizedSearch);
  }), [allEpisodes, filter, normalizedSearch, todayKey]);

  const grouped = useMemo(() => {
    const output = new Map<string, CalendarScheduleEpisode[]>();
    for (const episode of episodes) {
      const group = output.get(episode.date) || [];
      group.push(episode);
      output.set(episode.date, group);
    }
    return output;
  }, [episodes]);

  const metrics = useMemo(() => ({
    total: allEpisodes.length,
    upcoming: allEpisodes.filter((episode) => episode.date > todayKey).length,
    unwatched: allEpisodes.filter((episode) => !episode.watched && episode.date <= todayKey).length,
    today: allEpisodes.filter((episode) => episode.date === todayKey).length,
  }), [allEpisodes, todayKey]);

  const upcoming = useMemo(() => allEpisodes
    .filter((episode) => episode.date >= todayKey)
    .sort((a, b) => a.date.localeCompare(b.date) || a.showTitle.localeCompare(b.showTitle))
    .slice(0, 10), [allEpisodes, todayKey]);

  const navigate = (direction: -1 | 1) => {
    setCursor((current) => {
      if (mode === "week") {
        const next = new Date(current);
        next.setDate(next.getDate() + direction * 7);
        return next;
      }
      return new Date(current.getFullYear(), current.getMonth() + direction, 1, 12);
    });
  };

  const goToday = () => {
    const today = new Date();
    setCursor(new Date(today.getFullYear(), today.getMonth(), today.getDate(), 12));
  };

  const resetFilters = () => {
    setFilter("all");
    setSearch("");
  };

  return (
    <div className="space-y-6">
      <section className="relative overflow-hidden rounded-2xl border border-border/60 bg-gradient-to-br from-primary/15 via-card to-card p-4 sm:p-6">
        <div className="absolute -right-16 -top-20 h-48 w-48 rounded-full bg-primary/10 blur-3xl" />
        <div className="relative flex flex-col gap-5">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <h1 className={cn("flex items-center gap-2 font-extrabold tracking-tight", embedded ? "text-xl sm:text-2xl" : "text-2xl sm:text-3xl")}>
                <CalendarDays className="h-7 w-7 text-primary" /> {world === "arabic-tv" ? "Arabic TV Schedule" : "Episode Calendar"}
              </h1>
              <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
                {world === "arabic-tv"
                  ? "A dedicated timezone-safe schedule for followed Arabic TV shows only."
                  : "Every scheduled episode from your followed non-Arabic TV shows and anime, in one timezone-safe view."}
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Button variant="outline" size="icon" onClick={() => navigate(-1)} aria-label="Previous period">
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <Button variant="secondary" onClick={goToday} className="min-w-36 font-semibold">
                {rangeTitle(mode, cursor)}
              </Button>
              <Button variant="outline" size="icon" onClick={() => navigate(1)} aria-label="Next period">
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            <MetricCard label="Episodes" value={metrics.total} icon={<CalendarClock className="h-4 w-4" />} />
            <MetricCard label="Today" value={metrics.today} icon={<Sparkles className="h-4 w-4" />} />
            <MetricCard label="Upcoming" value={metrics.upcoming} icon={<Bell className="h-4 w-4" />} />
            <MetricCard label="Unwatched" value={metrics.unwatched} icon={<EyeOff className="h-4 w-4" />} />
          </div>
        </div>
      </section>

      <Card className="p-3 sm:p-4">
        <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
          <div className="flex flex-wrap gap-2">
            {(["month", "week", "agenda"] as CalendarMode[]).map((value) => (
              <Button
                key={value}
                size="sm"
                variant={mode === value ? "default" : "outline"}
                onClick={() => setMode(value)}
                className="capitalize"
              >
                {value}
              </Button>
            ))}
          </div>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <div className="relative min-w-0 sm:w-72">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search shows or episodes"
                className="pl-9"
              />
            </div>
            <div className="flex max-w-full gap-1 overflow-x-auto pb-1 sm:pb-0">
              {FILTERS.filter((item) => world === "arabic-tv" ? item.value !== "tv" && item.value !== "anime" : true).map((item) => (
                <Button
                  key={item.value}
                  size="sm"
                  variant={filter === item.value ? "secondary" : "ghost"}
                  onClick={() => setFilter(item.value)}
                  className="shrink-0"
                >
                  {item.label}
                </Button>
              ))}
            </div>
          </div>
        </div>
      </Card>

      {schedule.data?.partial && (
        <Alert>
          <AlertCircle />
          <AlertTitle>Some schedules could not be refreshed</AlertTitle>
          <AlertDescription>
            Showing all available episodes. Try again later for: {schedule.data.warnings.slice(0, 4).join(", ")}
            {schedule.data.warnings.length > 4 ? ` and ${schedule.data.warnings.length - 4} more` : ""}.
          </AlertDescription>
        </Alert>
      )}

      {schedule.isLoading ? (
        <CalendarLoading mode={mode} />
      ) : schedule.isError ? (
        <CalendarError
          message={schedule.error instanceof Error ? schedule.error.message : "The calendar could not be loaded."}
          onRetry={() => schedule.refetch()}
        />
      ) : (schedule.data?.shows.length ?? 0) === 0 ? (
        <EmptyCalendar
          title="Follow a show to build your calendar"
          description="Once you follow a TV show or anime, its dated episodes will appear here automatically."
          actionLabel={world === "arabic-tv" ? "Discover Arabic shows" : "Discover shows"}
          onAction={() => setView(world === "arabic-tv" ? "arabic-tv" : "discover")}
        />
      ) : episodes.length === 0 ? (
        <EmptyCalendar
          title={allEpisodes.length === 0 ? "No scheduled episodes in this period" : "No episodes match these filters"}
          description={allEpisodes.length === 0
            ? "Try another month or week. Your followed shows are still connected to the calendar."
            : "Clear the search and filters to see the complete schedule."}
          actionLabel={allEpisodes.length === 0 ? "Go to today" : "Reset filters"}
          onAction={allEpisodes.length === 0 ? goToday : resetFilters}
        />
      ) : (
        <>
          {mode === "month" && (
            <MonthCalendar
              cursor={cursor}
              grouped={grouped}
              todayKey={todayKey}
              onEpisode={setSelectedEpisode}
              onMore={setSelectedDay}
            />
          )}
          {mode === "week" && (
            <WeekCalendar
              days={weekCells(cursor)}
              grouped={grouped}
              todayKey={todayKey}
              onEpisode={setSelectedEpisode}
            />
          )}
          {mode === "agenda" && (
            <AgendaCalendar
              grouped={grouped}
              todayKey={todayKey}
              onEpisode={setSelectedEpisode}
            />
          )}
        </>
      )}

      <div className="grid gap-4 lg:grid-cols-[1.4fr_1fr]">
        <UpcomingPanel episodes={upcoming} todayKey={todayKey} onEpisode={setSelectedEpisode} />
        <YourSchedulePanel
          shows={schedule.data?.shows ?? []}
          onShow={(showId) => goTv(showId)}
          onDiscover={() => setView(world === "arabic-tv" ? "arabic-tv" : "discover")}
        />
      </div>

      <DayScheduleSheet
        dateKey={selectedDay}
        episodes={selectedDay ? (grouped.get(selectedDay) || []) : []}
        todayKey={todayKey}
        onOpenChange={(open) => { if (!open) setSelectedDay(null); }}
        onEpisode={(episode) => {
          setSelectedDay(null);
          setSelectedEpisode(episode);
        }}
      />

      <EpisodeSheet
        episode={selectedEpisode}
        todayKey={todayKey}
        onOpenChange={(open) => { if (!open) setSelectedEpisode(null); }}
        onShow={(showId) => {
          setSelectedEpisode(null);
          goTv(showId);
        }}
        onChanged={(watched) => setSelectedEpisode((current) => current ? { ...current, watched } : current)}
      />
    </div>
  );
}

function MetricCard({ label, value, icon }: { label: string; value: number; icon: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-border/50 bg-background/65 px-3 py-2.5 backdrop-blur">
      <div className="flex items-center justify-between text-muted-foreground">
        <span className="text-xs font-medium">{label}</span>
        {icon}
      </div>
      <p className="mt-1 text-xl font-extrabold">{value}</p>
    </div>
  );
}

function MonthCalendar({ cursor, grouped, todayKey, onEpisode, onMore }: {
  cursor: Date;
  grouped: Map<string, CalendarScheduleEpisode[]>;
  todayKey: string;
  onEpisode: (episode: CalendarScheduleEpisode) => void;
  onMore: (dateKey: string) => void;
}) {
  return (
    <Card className="animate-in fade-in-0 slide-in-from-bottom-1 overflow-hidden p-0 duration-300">
      <div className="sticky top-0 z-10 grid grid-cols-7 border-b bg-card/95 backdrop-blur">
        {WEEKDAY_LABELS.map((label) => (
          <div key={label} className="px-1 py-2 text-center text-[11px] font-bold text-muted-foreground sm:text-xs">{label}</div>
        ))}
      </div>
      <div className="grid grid-cols-7">
        {monthCells(cursor).map((dateKey, index) => {
          if (!dateKey) return <div key={`blank-${index}`} className="min-h-24 border-b border-r border-border/30 bg-muted/10 sm:min-h-32" />;
          const dayEpisodes = grouped.get(dateKey) || [];
          const isToday = dateKey === todayKey;
          const isPast = dateKey < todayKey;
          const weekday = dateOnlyToLocalDate(dateKey)?.getDay();
          const isWeekend = weekday === 0 || weekday === 6;
          return (
            <div
              key={dateKey}
              className={cn(
                "min-h-24 border-b border-r border-border/30 p-1 transition-colors sm:min-h-32 sm:p-1.5",
                isWeekend && "bg-muted/10",
                isToday && "bg-primary/8 ring-1 ring-inset ring-primary/60",
                isPast && !isToday && "bg-muted/5",
              )}
            >
              <div className="mb-1 flex items-center justify-between gap-1">
                <span className={cn(
                  "flex h-6 w-6 items-center justify-center rounded-full text-[11px] font-bold",
                  isToday ? "bg-primary text-primary-foreground" : "text-foreground/80",
                )}>
                  {dateOnlyToLocalDate(dateKey)?.getDate()}
                </span>
                {dayEpisodes.length > 0 && <span className="text-[9px] text-muted-foreground">{dayEpisodes.length}</span>}
              </div>
              <div className="space-y-1">
                {dayEpisodes.slice(0, 3).map((episode) => (
                  <EpisodeChip key={episode.id} episode={episode} onClick={() => onEpisode(episode)} compact />
                ))}
                {dayEpisodes.length > 3 && (
                  <button
                    className="w-full rounded px-1 py-0.5 text-left text-[9px] font-semibold text-primary hover:bg-primary/10"
                    onClick={() => onMore(dateKey)}
                  >
                    +{dayEpisodes.length - 3} more
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </Card>
  );
}

function WeekCalendar({ days, grouped, todayKey, onEpisode }: {
  days: string[];
  grouped: Map<string, CalendarScheduleEpisode[]>;
  todayKey: string;
  onEpisode: (episode: CalendarScheduleEpisode) => void;
}) {
  return (
    <div className="animate-in fade-in-0 slide-in-from-bottom-1 grid gap-3 duration-300 sm:grid-cols-7">
      {days.map((dateKey) => {
        const dayEpisodes = grouped.get(dateKey) || [];
        const isToday = dateKey === todayKey;
        return (
          <Card key={dateKey} className={cn("min-h-40 p-3", isToday && "border-primary/70 bg-primary/5")}>
            <div className="mb-3 border-b border-border/50 pb-2 text-center">
              <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                {formatDateOnly(dateKey, { weekday: "short" })}
              </p>
              <p className={cn("text-xl font-extrabold", isToday && "text-primary")}>
                {dateOnlyToLocalDate(dateKey)?.getDate()}
              </p>
            </div>
            <div className="space-y-2">
              {dayEpisodes.length === 0 ? (
                <p className="py-5 text-center text-[10px] text-muted-foreground">No episodes</p>
              ) : dayEpisodes.map((episode) => (
                <EpisodeChip key={episode.id} episode={episode} onClick={() => onEpisode(episode)} />
              ))}
            </div>
          </Card>
        );
      })}
    </div>
  );
}

function AgendaCalendar({ grouped, todayKey, onEpisode }: {
  grouped: Map<string, CalendarScheduleEpisode[]>;
  todayKey: string;
  onEpisode: (episode: CalendarScheduleEpisode) => void;
}) {
  return (
    <div className="animate-in fade-in-0 slide-in-from-bottom-1 space-y-4 duration-300">
      {[...grouped.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([dateKey, episodes]) => (
        <section key={dateKey}>
          <div className="mb-2 flex items-center gap-2">
            <div className={cn("h-2 w-2 rounded-full", dateKey === todayKey ? "bg-primary" : "bg-muted-foreground/40")} />
            <h2 className="text-sm font-bold">{relativeDateLabel(dateKey, todayKey)}</h2>
            <Badge variant="secondary" className="text-[10px]">{episodes.length}</Badge>
          </div>
          <div className="space-y-2">
            {episodes.map((episode) => (
              <AgendaEpisode key={episode.id} episode={episode} onClick={() => onEpisode(episode)} />
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}

function EpisodeChip({ episode, onClick, compact = false }: {
  episode: CalendarScheduleEpisode;
  onClick: () => void;
  compact?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={`${episode.showTitle} · S${episode.seasonNumber}E${episode.episodeNumber}: ${episode.episodeName}`}
      className={cn(
        "group w-full rounded-md border px-1.5 py-1 text-left transition-colors",
        episode.watched
          ? "border-emerald-500/20 bg-emerald-500/10 text-emerald-300 hover:bg-emerald-500/15"
          : episode.isAnime
            ? "border-fuchsia-500/20 bg-fuchsia-500/10 text-fuchsia-200 hover:bg-fuchsia-500/15"
            : "border-primary/20 bg-primary/10 text-primary hover:bg-primary/15",
      )}
    >
      <span className="flex items-center gap-1">
        {episode.watched ? <CheckCircle2 className="h-2.5 w-2.5 shrink-0" /> : <Circle className="h-2.5 w-2.5 shrink-0" />}
        <span className={cn("truncate font-semibold", compact ? "text-[8px] sm:text-[9px]" : "text-[10px]")}>
          {episode.showTitle}
        </span>
      </span>
      {!compact && (
        <span className="mt-0.5 block truncate text-[9px] opacity-80">
          S{String(episode.seasonNumber).padStart(2, "0")}E{String(episode.episodeNumber).padStart(2, "0")}
        </span>
      )}
    </button>
  );
}

function AgendaEpisode({ episode, onClick }: { episode: CalendarScheduleEpisode; onClick: () => void }) {
  return (
    <Card className="overflow-hidden p-0 transition-colors hover:border-primary/40">
      <button type="button" onClick={onClick} className="flex w-full items-center gap-3 p-3 text-left">
        <div className="h-16 w-12 shrink-0 overflow-hidden rounded-md bg-muted">
          <img src={imgOrPlaceholder(episode.showPoster, "w92")} alt={episode.showTitle} className="h-full w-full object-cover" loading="lazy" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <p className="truncate text-sm font-bold">{episode.showTitle}</p>
            {episode.isArabic ? <Badge variant="secondary" className="text-[9px]">Arabic TV</Badge> : episode.isAnime && <Badge variant="secondary" className="text-[9px]">Anime</Badge>}
          </div>
          <p className="mt-0.5 truncate text-xs text-muted-foreground">
            S{String(episode.seasonNumber).padStart(2, "0")}E{String(episode.episodeNumber).padStart(2, "0")} · {episode.episodeName}
          </p>
          <div className="mt-2 flex items-center gap-2 text-[10px] text-muted-foreground">
            {episode.runtime && <span className="flex items-center gap-1"><Clock3 className="h-3 w-3" />{episode.runtime}m</span>}
            <span className={cn("flex items-center gap-1", episode.watched && "text-emerald-400")}>
              {episode.watched ? <Eye className="h-3 w-3" /> : <EyeOff className="h-3 w-3" />}
              {episode.watched ? "Watched" : "Unwatched"}
            </span>
          </div>
        </div>
        <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
      </button>
    </Card>
  );
}

function UpcomingPanel({ episodes, todayKey, onEpisode }: {
  episodes: CalendarScheduleEpisode[];
  todayKey: string;
  onEpisode: (episode: CalendarScheduleEpisode) => void;
}) {
  const bucketed = useMemo(() => {
    const tomorrow = addDaysToDateOnly(todayKey, 1);
    const weekEnd = addDaysToDateOnly(todayKey, 7);
    const buckets: Array<{ label: string; items: CalendarScheduleEpisode[] }> = [
      { label: "Today", items: [] },
      { label: "Tomorrow", items: [] },
      { label: "This week", items: [] },
      { label: "Later", items: [] },
    ];

    for (const episode of episodes) {
      if (episode.date === todayKey) buckets[0].items.push(episode);
      else if (episode.date === tomorrow) buckets[1].items.push(episode);
      else if (weekEnd && episode.date <= weekEnd) buckets[2].items.push(episode);
      else buckets[3].items.push(episode);
    }
    return buckets.filter((bucket) => bucket.items.length > 0);
  }, [episodes, todayKey]);

  return (
    <Card className="p-4">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="flex items-center gap-2 font-bold"><Bell className="h-4 w-4 text-primary" /> Coming up</h2>
        <Badge variant="secondary">{episodes.length}</Badge>
      </div>
      {episodes.length === 0 ? (
        <p className="py-8 text-center text-sm text-muted-foreground">No upcoming episodes in this period.</p>
      ) : (
        <div className="space-y-4">
          {bucketed.map((bucket) => (
            <div key={bucket.label}>
              <p className="mb-1.5 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">{bucket.label}</p>
              <div className="space-y-2">
                {bucket.items.map((episode) => (
                  <button
                    key={`${episode.id}:${episode.date}`}
                    type="button"
                    onClick={() => onEpisode(episode)}
                    className="flex w-full items-center gap-3 rounded-lg border border-border/50 p-2 text-left transition-colors hover:bg-accent/50"
                  >
                    <div className="h-10 w-8 shrink-0 overflow-hidden rounded bg-muted">
                      <img src={imgOrPlaceholder(episode.showPoster, "w92")} alt="" className="h-full w-full object-cover" loading="lazy" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-xs font-semibold">{episode.showTitle}</p>
                      <p className="truncate text-[10px] text-muted-foreground">S{episode.seasonNumber}E{episode.episodeNumber} · {episode.episodeName}</p>
                    </div>
                    <span className="shrink-0 text-[10px] font-semibold text-primary">
                      {formatDateOnly(episode.date, { month: "short", day: "numeric" })}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}

function YourSchedulePanel({ shows, onShow, onDiscover }: {
  shows: Array<{ tmdbId: number; title: string; poster: string | null; isAnime: boolean; isArabic: boolean }>;
  onShow: (showId: number) => void;
  onDiscover: () => void;
}) {
  return (
    <Card className="p-4">
      <div className="mb-3 flex items-center justify-between gap-2">
        <h2 className="flex items-center gap-2 font-bold"><Tv className="h-4 w-4 text-primary" /> Your schedule</h2>
        <Button variant="ghost" size="sm" onClick={onDiscover}>Discover more</Button>
      </div>
      <p className="mb-3 text-xs text-muted-foreground">{shows.length} followed titles contribute to this calendar.</p>
      <div className="grid grid-cols-4 gap-2 sm:grid-cols-6 lg:grid-cols-4">
        {shows.slice(0, 8).map((show) => (
          <button key={show.tmdbId} type="button" onClick={() => onShow(show.tmdbId)} className="group text-left">
            <div className="aspect-[2/3] overflow-hidden rounded-md bg-muted ring-1 ring-border/50 transition group-hover:ring-primary/60">
              <img src={imgOrPlaceholder(show.poster, "w185")} alt={show.title} className="h-full w-full object-cover transition-transform group-hover:scale-105" loading="lazy" />
            </div>
            <p className="mt-1 truncate text-[10px] font-medium">{show.title}</p>
          </button>
        ))}
      </div>
      {shows.length > 8 && <p className="mt-3 text-center text-[10px] text-muted-foreground">+{shows.length - 8} more followed titles</p>}
    </Card>
  );
}

function DayScheduleSheet({ dateKey, episodes, todayKey, onOpenChange, onEpisode }: {
  dateKey: string | null;
  episodes: CalendarScheduleEpisode[];
  todayKey: string;
  onOpenChange: (open: boolean) => void;
  onEpisode: (episode: CalendarScheduleEpisode) => void;
}) {
  if (!dateKey) return null;
  return (
    <Sheet open={Boolean(dateKey)} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full overflow-y-auto sm:max-w-md">
        <SheetHeader>
          <SheetTitle>{relativeDateLabel(dateKey, todayKey)}</SheetTitle>
          <SheetDescription>{episodes.length} scheduled episode{episodes.length === 1 ? "" : "s"}</SheetDescription>
        </SheetHeader>
        <div className="space-y-2 px-4 pb-6">
          {episodes.map((episode) => (
            <AgendaEpisode key={episode.id} episode={episode} onClick={() => onEpisode(episode)} />
          ))}
        </div>
      </SheetContent>
    </Sheet>
  );
}

function EpisodeSheet({ episode, todayKey, onOpenChange, onShow, onChanged }: {
  episode: CalendarScheduleEpisode | null;
  todayKey: string;
  onOpenChange: (open: boolean) => void;
  onShow: (showId: number) => void;
  onChanged: (watched: boolean) => void;
}) {
  const toggle = useEpisodeToggle();
  const bulkToggle = useBulkEpisodeToggle();
  const timeline = useEpisodeWatchTimeline(episode?.showId ?? null);
  const [watchPlan, setWatchPlan] = useState<EpisodeWatchPlan | null>(null);
  if (!episode) return null;

  const isFuture = episode.date > todayKey;
  const fullDate = formatDateOnly(episode.date, { weekday: "long", month: "long", day: "numeric", year: "numeric" }) || episode.date;

  const applyWatchPlan = async (plan: EpisodeWatchPlan, includePrevious: boolean) => {
    const episodes = includePrevious ? plan.allEpisodes : plan.selectedEpisodes;
    if (episodes.length === 0) {
      setWatchPlan(null);
      return;
    }
    try {
      await (episodes.length === 1
        ? toggle.mutateAsync({
            action: "add",
            showId: episode.showId,
            seasonNumber: episodes[0].seasonNumber,
            episodeNumber: episodes[0].episodeNumber,
            episodeName: episodes[0].episodeName || undefined,
          })
        : bulkToggle.mutateAsync({ showId: episode.showId, episodes }));
      onChanged(true);
      toast.success(
        includePrevious && plan.previousUnwatched.length > 0
          ? `Marked ${episodes.length} released episodes as watched, including earlier gaps.`
          : `${plan.targetLabel} marked as watched.`,
      );
      setWatchPlan(null);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to update episode");
    }
  };

  const changeWatched = async () => {
    if (episode.watched) {
      try {
        await toggle.mutateAsync({
          action: "remove",
          showId: episode.showId,
          seasonNumber: episode.seasonNumber,
          episodeNumber: episode.episodeNumber,
          episodeName: episode.episodeName,
        });
        onChanged(false);
        toast.success("Episode marked unwatched");
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "Failed to update episode");
      }
      return;
    }

    if (timeline.isLoading || timeline.isError || !timeline.data) {
      toast.error(timeline.isError
        ? "Could not verify earlier episodes. Try again before changing progress."
        : "Earlier episode history is still loading. Try again in a moment.");
      return;
    }

    const plan = buildEpisodeWatchPlan({
      target: {
        seasonNumber: episode.seasonNumber,
        episodeNumber: episode.episodeNumber,
        episodeName: episode.episodeName,
      },
      releasedEpisodes: timeline.data.releasedEpisodes,
      watchedKeys: new Set(timeline.data.watchedKeys),
    });
    if (plan.previousUnwatched.length > 0) {
      setWatchPlan(plan);
      return;
    }
    await applyWatchPlan(plan, false);
  };

  return (
    <>
    <Sheet open={Boolean(episode)} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full overflow-y-auto sm:max-w-lg">
        <div className="relative aspect-video overflow-hidden bg-muted">
          <img
            src={episode.stillPath ? img(episode.stillPath, "w780") : imgOrPlaceholder(episode.showBackdrop || episode.showPoster, "w780")}
            alt={episode.episodeName}
            className="h-full w-full object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-background via-transparent to-transparent" />
        </div>
        <SheetHeader className="px-5 pb-0 pt-2">
          <div className="mb-1 flex flex-wrap items-center gap-2">
            <Badge variant="secondary">S{String(episode.seasonNumber).padStart(2, "0")}E{String(episode.episodeNumber).padStart(2, "0")}</Badge>
            {episode.isArabic ? <Badge className="bg-emerald-500/15 text-emerald-300">Arabic TV</Badge> : episode.isAnime && <Badge className="bg-fuchsia-500/15 text-fuchsia-300">Anime</Badge>}
            <Badge variant={episode.watched ? "default" : "outline"}>{episode.watched ? "Watched" : isFuture ? "Upcoming" : "Unwatched"}</Badge>
          </div>
          <SheetTitle className="text-xl">{episode.episodeName}</SheetTitle>
          <SheetDescription>{episode.showTitle}</SheetDescription>
        </SheetHeader>

        <div className="space-y-5 px-5 pb-6">
          <div className="grid grid-cols-2 gap-2">
            <InfoTile label="Air date" value={fullDate} icon={<CalendarDays className="h-4 w-4" />} />
            <InfoTile label="Runtime" value={episode.runtime ? `${episode.runtime} minutes` : "Not listed"} icon={<Clock3 className="h-4 w-4" />} />
          </div>

          {episode.networkNames.length > 0 && (
            <div>
              <p className="mb-2 text-xs font-semibold text-muted-foreground">Network</p>
              <div className="flex flex-wrap gap-1.5">
                {episode.networkNames.map((network) => <Badge key={network} variant="outline">{network}</Badge>)}
              </div>
            </div>
          )}

          <div>
            <h3 className="mb-2 text-sm font-bold">Episode overview</h3>
            <p className="text-sm leading-relaxed text-foreground/75">{episode.overview || "No episode overview is available yet."}</p>
          </div>

          <div className="grid gap-2 sm:grid-cols-2">
            <Button
              onClick={changeWatched}
              disabled={toggle.isPending || bulkToggle.isPending || (isFuture && !episode.watched) || (!episode.watched && timeline.isLoading)}
              variant={episode.watched ? "outline" : "default"}
            >
              {episode.watched ? <EyeOff className="mr-2 h-4 w-4" /> : <CheckCircle2 className="mr-2 h-4 w-4" />}
              {episode.watched ? "Mark unwatched" : isFuture ? "Not aired yet" : "Mark watched"}
            </Button>
            <Button variant="secondary" onClick={() => onShow(episode.showId)}>
              <ExternalLink className="mr-2 h-4 w-4" /> Open show
            </Button>
            {episode.trailerKey && (
              <Button
                variant="outline"
                className="sm:col-span-2"
                onClick={() => window.open(`https://www.youtube.com/watch?v=${episode.trailerKey}`, "_blank", "noopener,noreferrer")}
              >
                <Play className="mr-2 h-4 w-4 fill-current" /> Watch trailer
              </Button>
            )}
          </div>
        </div>
      </SheetContent>
    </Sheet>
    <EpisodeWatchConfirmationDialog
      plan={watchPlan}
      open={Boolean(watchPlan)}
      pending={toggle.isPending || bulkToggle.isPending}
      onOpenChange={(nextOpen) => { if (!nextOpen) setWatchPlan(null); }}
      onSelectedOnly={() => watchPlan ? applyWatchPlan(watchPlan, false) : undefined}
      onWithPrevious={() => watchPlan ? applyWatchPlan(watchPlan, true) : undefined}
    />
    </>
  );
}

function InfoTile({ label, value, icon }: { label: string; value: string; icon: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-border/50 bg-muted/20 p-3">
      <div className="mb-1 flex items-center gap-1.5 text-muted-foreground">{icon}<span className="text-[10px] font-semibold">{label}</span></div>
      <p className="text-xs font-bold">{value}</p>
    </div>
  );
}

function CalendarLoading({ mode }: { mode: CalendarMode }) {
  return (
    <Card className="p-4">
      <div className={cn("grid gap-2", mode === "month" ? "grid-cols-7" : mode === "week" ? "sm:grid-cols-7" : "grid-cols-1")}>
        {Array.from({ length: mode === "month" ? 35 : 7 }, (_, index) => (
          <Skeleton key={index} className={cn("rounded-lg", mode === "agenda" ? "h-20" : "h-28")} />
        ))}
      </div>
    </Card>
  );
}

function CalendarError({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <Alert variant="destructive">
      <AlertCircle />
      <AlertTitle>Calendar unavailable</AlertTitle>
      <AlertDescription>
        <p>{message}</p>
        <Button variant="outline" size="sm" onClick={onRetry} className="mt-2">
          <RotateCcw className="mr-2 h-4 w-4" /> Try again
        </Button>
      </AlertDescription>
    </Alert>
  );
}

function EmptyCalendar({ title, description, actionLabel, onAction }: {
  title: string;
  description: string;
  actionLabel: string;
  onAction: () => void;
}) {
  return (
    <Card className="p-10 text-center">
      <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10 text-primary">
        <ListFilter className="h-7 w-7" />
      </div>
      <h2 className="font-bold">{title}</h2>
      <p className="mx-auto mt-1 max-w-md text-sm text-muted-foreground">{description}</p>
      <Button className="mt-4" onClick={onAction}>{actionLabel}</Button>
    </Card>
  );
}
