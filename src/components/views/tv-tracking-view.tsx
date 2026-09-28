"use client";

import { useTvTracking, useTvTrackingCounts, type TvTrackingCategory } from "@/hooks/use-tmdb";
import { useNav } from "@/lib/store";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { FilterField, FilterGrid, FilterPanel, FilterSection } from "@/components/ui/filter-panel";
import { SafeImage } from "@/components/media/safe-image";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { WatchedIndicator } from "@/components/media/watched-indicator";
import { TmdbScoreIndicator } from "@/components/media/tmdb-score-indicator";
import { WatchlistIndicator } from "@/components/media/watchlist-indicator";
import { Play, Tv, Clock, Calendar, Clapperboard, BookOpen, Trophy, Star, Zap, Layers, PauseCircle, CirclePlay, ChevronLeft, ChevronRight, Grid2X2, List, CircleStop, Search, ArrowUpDown, SlidersHorizontal } from "lucide-react";
import { imgOrPlaceholder, pickArabicTitle } from "@/lib/tmdb";
import { cn } from "@/lib/utils";
import { motion } from "framer-motion";
import { useEffect, useState } from "react";
import { PageTitlebar } from "@/components/ui/page-titlebar";
import { EmptyState } from "@/components/ui/empty-state";
import { ErrorState } from "@/components/ui/error-state";


// Tracking status is calculated by the shared server engine.
type TrackingStatus = "planned" | "not_started" | "watching" | "uptodate" | "finished" | "stopped";

const TV_GENRES = [
  "Action & Adventure", "Animation", "Comedy", "Crime", "Documentary", "Drama",
  "Family", "Kids", "Mystery", "News", "Reality", "Sci-Fi & Fantasy",
  "Soap", "Talk", "War & Politics", "Western",
] as const;

// One consistent status palette: success (emerald), warning (amber),
// destructive for stopped/stale, primary for neutral selections and muted
// for not-started states.
const STATUS_TONE = {
  primary: "bg-primary/15 text-primary",
  success: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300",
  warning: "bg-amber-500/15 text-amber-700 dark:text-amber-300",
  danger: "bg-destructive/15 text-destructive",
  muted: "bg-muted text-muted-foreground",
} as const;

function deriveTrackingStatus(show: any): TrackingStatus {
  const value = String(show?._trackingStatus || show?.status || "not_started").toLowerCase();
  if (value === "finished") {
    if (show?._isEndedByTmdb === true) return "finished";
    return show?._hasUnwatchedReleasedEpisode ? "watching" : "uptodate";
  }
  if (value === "planned" || value === "not_started" || value === "watching" || value === "uptodate" || value === "stopped") {
    return value;
  }
  if (value === "watched") return show?._isEndedByTmdb === true ? "finished" : "uptodate";
  return "not_started";
}

function TrackingStatusBadge({ status, isArabic = false }: { status: TrackingStatus; isArabic?: boolean }) {
  // Colors come exclusively from the [data-status] rules in globals.css
  // (light + dark variants) so every surface renders the same status palette.
  const badgeClass = "h-8 gap-1.5 px-3 text-xs";
  if (status === "stopped") {
    return <Badge data-status="stopped" className={badgeClass}><CircleStop className="h-3.5 w-3.5" /> {isArabic ? "توقفت عن مشاهدته" : "Stopped Watching"}</Badge>;
  }
  if (status === "finished") {
    return <Badge data-status="finished" className={badgeClass}><Trophy className="h-3.5 w-3.5" /> {isArabic ? "مكتمل" : "Finished"}</Badge>;
  }
  if (status === "uptodate") {
    return <Badge data-status="uptodate" className={badgeClass}><Zap className="h-3.5 w-3.5" /> {isArabic ? "محدّث" : "Up to Date"}</Badge>;
  }
  if (status === "watching") {
    return <Badge data-status="watching" className={badgeClass}><Play className="h-3.5 w-3.5 fill-current" /> {isArabic ? "قيد المشاهدة" : "Watching"}</Badge>;
  }
  if (status === "planned") {
    return <Badge data-status="planned" className={badgeClass}><BookOpen className="h-3.5 w-3.5" /> {isArabic ? "قائمة المشاهدة" : "Planned"}</Badge>;
  }
  return <Badge data-status="not_started" className={badgeClass}><Clock className="h-3.5 w-3.5" /> {isArabic ? "لم يبدأ" : "Not Started"}</Badge>;
}

type TvSort = "title" | "addedAt" | "watchedAt";
const DEFAULT_TV_SORT: TvSort = "watchedAt";
// [value, English label, Arabic label] — mirrors the movie library's segmented sort.
const TV_SORT_OPTIONS: ReadonlyArray<readonly [TvSort, string, string]> = [
  ["watchedAt", "Last Watched", "آخر مشاهدة"],
  ["addedAt", "Recent", "الأحدث إضافة"],
  ["title", "A-Z", "أ-ي"],
];

export function TvShowsView({ world = "standard", embedded = false, onDiscover }: { world?: "standard" | "arabic" | "asian"; embedded?: boolean; onDiscover?: () => void }) {
  const trackingCounts = useTvTrackingCounts(world);
  const counts = trackingCounts.data?.counts;
  const goTv = useNav((s) => s.goTv);
  const isArabic = world === "arabic";

  return (
    <div className="tvtime-tv-tracking-page space-y-5">
      {!embedded && (
        <PageTitlebar title={isArabic ? "المسلسلات العربية" : world === "asian" ? "Asian TV Shows" : "TV Shows"} />
      )}

      {/* Same masthead as the movie and Anime libraries; counts cover the full collection. */}
      <div className="tvtime-library-masthead">
        <div className="tvtime-library-stats grid max-w-3xl grid-cols-2 gap-3 sm:grid-cols-4">
          <LibraryStat icon={<Play />} label={isArabic ? "قيد المشاهدة" : "Watching"} value={counts?.watching ?? "…"} />
          <LibraryStat icon={<BookOpen />} label={isArabic ? "قائمة المشاهدة" : "Watchlist"} value={counts?.watchlist ?? counts?.planned ?? "…"} />
          <LibraryStat icon={<Zap />} label={isArabic ? "محدّث" : "Up To Date"} value={counts?.uptodate ?? "…"} />
          <LibraryStat icon={<Trophy />} label={isArabic ? "مكتمل" : "Finished"} value={counts?.finished ?? "…"} />
        </div>
      </div>

      <AllShowsTab onGo={goTv} globalCounts={counts} world={world} onDiscover={onDiscover} />
    </div>
  );
}

// ============ TAB COMPONENTS ============

// "All" tab — shows every tracked series, each badged with its current tracking
// status (Finished / Up To Date / Watching / Not Started / Planned). Includes quick filter chips so the
// user can drill into a specific status without leaving the tab.
function AllShowsTab({ onGo, globalCounts, world, onDiscover }: { onGo: (id: number) => void; globalCounts?: any; world: "standard" | "arabic" | "asian"; onDiscover?: () => void }) {
  const [page, setPage] = useState(0);
  const [filter, setFilter] = useState<TvTrackingCategory>("all");
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [genre, setGenre] = useState("");
  const [sortBy, setSortBy] = useState<TvSort>(DEFAULT_TV_SORT);
  const [layout, setLayout] = useState<"list" | "grid">("grid");
  const limit = 60;

  useEffect(() => {
    const timer = window.setTimeout(() => setDebouncedSearch(search.trim()), 250);
    return () => window.clearTimeout(timer);
  }, [search]);

  const order = sortBy === "title" ? "asc" : "desc";
  const tracking = useTvTracking({
    category: filter,
    search: debouncedSearch || undefined,
    genre: genre || undefined,
    sortBy,
    order,
    limit,
    offset: page * limit,
    world,
  });

  const items = tracking.data?.items ?? [];
  const total = tracking.data?.total ?? 0;
  const counts = tracking.data?.counts ?? globalCounts ?? {
    all: 0,
    planned: 0,
    watchlist: 0,
    notStarted: 0,
    watching: 0,
    uptodate: 0,
    finished: 0,
    stopped: 0,
    upcoming: 0,
    haventWatched: 0,
    haventStarted: 0,
  };
  const totalPages = Math.ceil(total / limit);
  const isArabic = world === "arabic";

  const filters: {
    value: TvTrackingCategory;
    label: string;
    count: number;
    icon?: React.ReactNode;
    color: string;
  }[] = [
    { value: "all", label: isArabic ? "الكل" : "All", count: counts.all, icon: <Layers className="w-3 h-3" />, color: STATUS_TONE.primary },
    { value: "watchlist", label: isArabic ? "قائمة المشاهدة" : "Watchlist", count: counts.watchlist ?? counts.planned, icon: <BookOpen className="w-3 h-3" />, color: STATUS_TONE.primary },
    { value: "uptodate", label: isArabic ? "محدّث" : "Up To Date", count: counts.uptodate, icon: <Zap className="w-3 h-3" />, color: STATUS_TONE.success },
    { value: "finished", label: isArabic ? "مكتمل" : "Finished", count: counts.finished, icon: <Trophy className="w-3 h-3" />, color: STATUS_TONE.success },
    { value: "stopped", label: isArabic ? "توقفت عن مشاهدته" : "Stopped Watching", count: counts.stopped ?? 0, icon: <CircleStop className="w-3 h-3" />, color: STATUS_TONE.danger },
    { value: "upcoming", label: isArabic ? "قادم" : "Upcoming", count: counts.upcoming, icon: <Calendar className="w-3 h-3" />, color: STATUS_TONE.warning },
    { value: "havent-watched", label: isArabic ? "لم أشاهده" : "Haven't Watched", count: counts.haventWatched, icon: <Play className="w-3 h-3" />, color: STATUS_TONE.warning },
    { value: "havent-started", label: isArabic ? "لم أبدأه" : "Haven't Started", count: counts.haventStarted ?? counts.notStarted, icon: <Clock className="w-3 h-3" />, color: STATUS_TONE.muted },
    { value: "stale", label: isArabic ? "متوقف منذ 30 يوماً" : "Paused 30+ Days", count: counts.stale ?? 0, icon: <PauseCircle className="w-3 h-3" />, color: STATUS_TONE.danger },
  ];

  const activeFilterLabel = filters.find((f) => f.value === filter)?.label ?? (isArabic ? "الكل" : "All");
  const activeFilterCount = Number(filter !== "all") + Number(search.trim() !== "") + Number(genre !== "") + Number(sortBy !== DEFAULT_TV_SORT);

  const resetFilters = () => {
    setFilter("all");
    setSearch("");
    setDebouncedSearch("");
    setGenre("");
    setSortBy(DEFAULT_TV_SORT);
    setPage(0);
  };

  useEffect(() => {
    const savedLayout = window.localStorage.getItem("tvtime:tv-card-layout");
    if (savedLayout === "list" || savedLayout === "grid") setLayout(savedLayout);
  }, []);

  const changeLayout = (nextLayout: "list" | "grid") => {
    setLayout(nextLayout);
    window.localStorage.setItem("tvtime:tv-card-layout", nextLayout);
  };

  return (
    <div className="tvtime-tracking-library space-y-4">
      <FilterPanel
        title={isArabic ? "فلاتر المكتبة" : "Library filters"}
        description={isArabic
          ? "تصفّح مسلسلاتك العربية حسب حالة المتابعة والنوع والبحث. كل رقم محسوب من كامل مجموعة المسلسلات العربية."
          : world === "asian"
            ? "Browse your Asian TV shows by tracking status, genre and search. Every number is calculated across your Asian TV collection only."
            : "Browse your TV shows by tracking status, genre and search. Every number is calculated across your complete TV Shows collection."}
        activeCount={activeFilterCount}
        onReset={resetFilters}
        resetLabel={isArabic ? "إعادة الضبط" : "Reset all"}
        mobileSheet
        className="tvtime-library-filter-panel"
        mobileResultLabel={isArabic ? `عرض ${total} مسلسل` : `Show ${total} shows`}
      >
        <FilterSection title={isArabic ? "حالة المتابعة" : "Tracking status"}>
          <div className="tvtime-tracking-status-grid">
            {filters.map((item) => (
              <FilterChip
                key={item.value}
                active={filter === item.value}
                onClick={() => { setFilter(item.value); setPage(0); }}
                label={item.label}
                icon={item.icon}
                count={item.count}
                color={item.color}
              />
            ))}
          </div>
        </FilterSection>

        <FilterSection title={isArabic ? "النوع" : "Genre"} divided>
          <FilterField label={isArabic ? "نوع المسلسل" : "TV genre"}>
            <Select
              value={genre || "all"}
              onValueChange={(value) => {
                setGenre(value === "all" ? "" : value);
                setPage(0);
              }}
            >
              <SelectTrigger className="h-10 w-full max-w-sm rounded-xl text-sm" aria-label={isArabic ? "فلتر نوع المسلسلات" : "Filter TV Shows by genre"}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{isArabic ? "كل الأنواع" : "All genres"}</SelectItem>
                {TV_GENRES.map((item) => (
                  <SelectItem key={item} value={item}>{item}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </FilterField>
        </FilterSection>

        <FilterSection title={isArabic ? "البحث والترتيب" : "Search and sort"} divided>
          <FilterGrid className="lg:grid-cols-[minmax(0,1fr)_auto]">
            <FilterField label={isArabic ? "البحث في المجموعة" : "Search collection"}>
              <div className="relative">
                <Search className="pointer-events-none absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={search}
                  onChange={(event) => { setSearch(event.target.value); setPage(0); }}
                  placeholder={isArabic ? "ابحث باسم المسلسل..." : "Search your shows..."}
                  className="h-10 ps-9"
                  aria-label={isArabic ? "البحث في المسلسلات" : "Search TV Shows"}
                />
              </div>
            </FilterField>

            <FilterField label={isArabic ? "الترتيب حسب" : "Sort by"}>
              <div className="tvtime-collection-sort-options flex min-h-10 flex-wrap items-center gap-1 rounded-xl border border-border/50 bg-muted/25 p-1">
                <ArrowUpDown aria-hidden="true" className="ms-1.5 h-3.5 w-3.5 text-muted-foreground" />
                {TV_SORT_OPTIONS.map(([value, english, arabic]) => (
                  <button
                    key={value}
                    type="button"
                    aria-pressed={sortBy === value}
                    onClick={() => { setSortBy(value); setPage(0); }}
                    className={`min-h-8 rounded-lg px-2.5 py-1 text-xs font-medium transition-colors ${
                      sortBy === value ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    {isArabic ? arabic : english}
                  </button>
                ))}
              </div>
            </FilterField>
          </FilterGrid>
        </FilterSection>
      </FilterPanel>

      <div className="tvtime-mobile-library-toolbar tvtime-mobile-experience-only" role="toolbar" aria-label={isArabic ? "أدوات المكتبة" : "Library tools"}>
        <div className="tvtime-mobile-library-toolbar__tabs">
          <button type="button" data-active={filter === "all" ? "true" : "false"} onClick={() => { setFilter("all"); setPage(0); }}>
            {isArabic ? "الكل" : "All"}
          </button>
          <button type="button" data-active={filter === "watchlist" ? "true" : "false"} onClick={() => { setFilter("watchlist"); setPage(0); }}>
            {isArabic ? "القائمة" : "Watchlist"}
          </button>
        </div>
        <Button type="button" variant="outline" className="h-10" onClick={() => window.dispatchEvent(new Event("tvtime:open-filters"))}>
          <SlidersHorizontal className="h-4 w-4" />
          {isArabic ? `فلتر${activeFilterCount ? ` · ${activeFilterCount}` : ""}` : `Filters${activeFilterCount ? ` · ${activeFilterCount}` : ""}`}
        </Button>
      </div>

      <div className="tvtime-library-results-toolbar">
        <p className="text-sm text-muted-foreground">
          {isArabic ? "يُعرض" : "Showing"} <span className="font-bold text-foreground">{items.length}</span> {isArabic ? "من" : "of"} <span className="font-bold text-foreground">{total}</span> {isArabic ? "مسلسلاً" : world === "asian" ? "Asian shows" : "shows"}
          {filter !== "all" && <> · <span className="font-semibold text-foreground">{activeFilterLabel}</span></>}
        </p>
        <div className="flex justify-end gap-1" role="group" aria-label={isArabic ? "طريقة عرض المكتبة" : "Library layout"}>
          <Button size="icon" variant={layout === "grid" ? "default" : "outline"} className="size-10" onClick={() => changeLayout("grid")} aria-pressed={layout === "grid"} title={isArabic ? "شبكة" : "Grid"}><Grid2X2 className="h-4 w-4" /></Button>
          <Button size="icon" variant={layout === "list" ? "default" : "outline"} className="size-10" onClick={() => changeLayout("list")} aria-pressed={layout === "list"} title={isArabic ? "قائمة" : "List"}><List className="h-4 w-4" /></Button>
        </div>
      </div>

      {tracking.isLoading ? (
        <div data-layout={layout} className={cn("tvtime-tracking-cards grid grid-cols-1 gap-4", layout === "grid" && "lg:grid-cols-2 min-[2100px]:grid-cols-3")}>
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="shimmer h-[300px] rounded-2xl sm:h-[280px]" />
          ))}
        </div>
      ) : tracking.isError ? (
        <ErrorState
          arabic={isArabic}
          title={isArabic ? "تعذّر تحميل مكتبتك" : "Couldn’t load your TV collection"}
          onRetry={() => void tracking.refetch()}
        />
      ) : items.length === 0 ? (
        <EmptyState
          icon={<Layers className="size-8" />}
          title={search.trim()
            ? (isArabic ? `لا توجد نتائج لـ «${search.trim()}»` : `No results for “${search.trim()}”`)
            : filter === "all"
              ? (isArabic ? "لا توجد مسلسلات عربية متابَعة بعد" : world === "asian" ? "No tracked Asian shows yet" : "No tracked shows yet")
              : (isArabic ? `لا توجد مسلسلات ضمن «${activeFilterLabel}»` : `No ${activeFilterLabel} shows`)}
          description={search.trim()
            ? (isArabic ? "جرّب اسماً مختلفاً أو أعد ضبط الفلاتر." : "Try another title or reset the filters.")
            : filter === "all"
              ? (isArabic ? "أضف مسلسلاً عربياً إلى مكتبتك لتبدأ المتابعة" : world === "asian" ? "Follow an Asian TV show to start tracking" : "Follow TV shows to start tracking")
              : (isArabic ? "هذا الفلتر فارغ ضمن كامل مجموعة المسلسلات العربية" : `This filter is empty across your full ${world === "asian" ? "Asian TV" : "TV Shows"} collection`)}
          action={search.trim() || filter !== "all" || genre ? (
            <Button type="button" variant="outline" onClick={resetFilters}>{isArabic ? "إعادة الضبط" : "Reset filters"}</Button>
          ) : onDiscover ? (
            <Button type="button" onClick={onDiscover}>{isArabic ? "تصفّح" : "Browse"}</Button>
          ) : undefined}
        />
      ) : (
        <>
          <div data-layout={layout} className={cn("tvtime-tracking-cards grid grid-cols-1 gap-4 sm:gap-5", layout === "grid" && "lg:grid-cols-2 min-[2100px]:grid-cols-3")}>
            {items.map((s: any) => (
              <AllShowCard key={s.id} show={{ ...s, _trackingStatus: s._trackingStatus ?? deriveTrackingStatus(s) }} onGo={() => s.tmdbId && onGo(s.tmdbId)} layout={layout} isArabic={isArabic} />
            ))}
          </div>
          {totalPages > 1 && (
            <div className="flex items-center justify-center gap-2 pt-4">
              <Button variant="outline" size="sm" disabled={page === 0} onClick={() => setPage((p) => Math.max(0, p - 1))}>
                {isArabic ? "السابق" : "Prev"}
              </Button>
              <span className="text-sm text-muted-foreground px-3">
                {isArabic ? <>الصفحة <span className="font-bold text-foreground">{page + 1}</span> من {totalPages}</> : <>Page <span className="font-bold text-foreground">{page + 1}</span> of {totalPages}</>}
              </span>
              <Button variant="outline" size="sm" disabled={page >= totalPages - 1} onClick={() => setPage((p) => p + 1)}>
                {isArabic ? "التالي" : "Next"}
              </Button>
            </div>
          )}
        </>
      )}
    </div>
  );
}

function FilterChip({ active, onClick, label, icon, count, color }: {
  active: boolean;
  onClick: () => void;
  label: string;
  icon?: React.ReactNode;
  count: number;
  color: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      data-active={active}
      aria-pressed={active}
      className={`tvtime-tracking-status-option ${
        active
          ? `${color} border-current/30 shadow-[var(--app-shadow-sm)]`
          : "border-border/60 bg-background/50 text-muted-foreground hover:border-border hover:bg-muted/55 hover:text-foreground"
      }`}
    >
      <span className="tvtime-tracking-status-option__icon" aria-hidden="true">{icon}</span>
      <span className="tvtime-tracking-status-option__label">{label}</span>
      <span className={`tvtime-tracking-status-option__count ${active ? "bg-background/45" : "bg-muted/80"}`}>{count}</span>
    </button>
  );
}

function AllShowCard({ show, onGo, layout, isArabic = false }: { show: any; onGo: () => void; layout: "list" | "grid"; isArabic?: boolean }) {
  const trackingStatus = show._trackingStatus as TrackingStatus;
  const userRating = trackingStatus === "finished" && show._isEndedByTmdb === true
    ? show.userRating
    : null;
  const tmdbRating = show.rating ? Number.parseFloat(show.rating) : null;
  const totalEps = show._airedEpisodeCount ?? show.episodes;
  const seasons = show.seasons;
  const compact = layout === "grid";
  const displayTitle = isArabic ? pickArabicTitle(show, "tv", show.title) : show.title;
  const watchedEps = show._watchedAiredEpisodeCount ?? 0;
  const releasedEps = show._airedEpisodeCount ?? totalEps ?? null;

  const activity = trackingStatus === "stopped"
    ? { tone: "danger", text: isArabic ? "توقفت عن المشاهدة — تم حفظ تقدمك" : "Stopped watching — progress saved", icon: CircleStop }
    : show._hasUnwatchedReleasedEpisode
      ? { tone: "warning", text: isArabic ? "توجد حلقة صادرة بانتظارك — تابع المشاهدة" : "Released episode waiting — continue watching", icon: CirclePlay }
    : show._nextEpisodeAirDate
      ? {
          tone: "info",
          text: `${isArabic ? "القادمة" : "Upcoming"}: ${show._nextEpisodeSeasonNumber ? `S${show._nextEpisodeSeasonNumber}` : ""}${show._nextEpisodeNumber ? `E${show._nextEpisodeNumber}` : ""}${show._nextEpisodeName ? ` · ${show._nextEpisodeName}` : ""} · ${new Date(show._nextEpisodeAirDate).toLocaleDateString(isArabic ? "ar-IQ" : "en-US", { month: "short", day: "numeric", year: "numeric" })}`,
          icon: Calendar,
        }
      : show._daysSinceLastWatch != null && show._daysSinceLastWatch >= 30 && trackingStatus !== "finished"
        ? { tone: "danger", text: isArabic ? `آخر مشاهدة قبل ${show._daysSinceLastWatch} يوماً` : `Last watched ${show._daysSinceLastWatch} days ago`, icon: PauseCircle }
        : { tone: "primary", text: isArabic ? "فتح تفاصيل المسلسل" : "Open series details", icon: Tv };
  const ActivityIcon = activity.icon;
  const activityTone = activity.tone === "warning"
    ? "border-amber-500/20 bg-amber-500/5 text-amber-700 dark:text-amber-300 group-hover:bg-amber-500/10"
    : activity.tone === "info"
      ? "border-chart-5/20 bg-chart-5/5 text-chart-5 group-hover:bg-chart-5/10"
      : activity.tone === "danger"
        ? "border-destructive/20 bg-destructive/5 text-destructive group-hover:bg-destructive/10"
        : "border-primary/15 bg-primary/5 text-primary group-hover:bg-primary/10";

  return (
    <motion.a
      href={show.tmdbId ? `/tv/${show.tmdbId}` : undefined}
      dir={isArabic ? "rtl" : undefined}
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      onClick={(event) => { if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return; event.preventDefault(); onGo(); }}
      className="block rounded-2xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/70"
    >
      <Card className={cn(
        "tvtime-tracking-card group relative cursor-pointer overflow-hidden rounded-2xl border-border/60 bg-card p-3.5 shadow-[var(--app-shadow-md)] transition-[border-color,box-shadow,transform] duration-300 hover:-translate-y-0.5 hover:border-primary/30 hover:shadow-[var(--app-shadow-lg)] sm:p-5",
      )}>
        <div className={cn(
          "tvtime-tracking-card__layout relative grid grid-cols-[92px_minmax(0,1fr)] items-start gap-3.5 sm:items-center",
          compact
            ? "sm:grid-cols-[clamp(105px,23%,135px)_minmax(0,1fr)] sm:gap-5"
            : "sm:grid-cols-[clamp(125px,20%,175px)_minmax(0,1fr)] sm:gap-6",
        )}>
          {/* Scope the poster to the shared media-card theme so Library uses
              the same frame, score corners and bookmark as the catalogue. */}
          <div className="tvtime-media-card tvtime-tracking-card__poster relative min-w-0 w-full sm:self-center" data-media-type="tv">
            <div className="tvtime-media-poster relative aspect-[2/3] overflow-hidden bg-muted">
              <SafeImage
                src={imgOrPlaceholder(show.poster, "w342")}
                alt={displayTitle}
                fill
                variant="poster"
                sizes="(max-width: 359px) 128px, (max-width: 639px) 88px, 112px"
                loading="lazy"
                decoding="async"
                className="tvtime-media-poster__image object-cover"
              />
              <div className="tvtime-media-poster__veil pointer-events-none absolute inset-0" aria-hidden="true" />
              {trackingStatus === "finished" && (
                <WatchedIndicator rating={userRating} status="finished" />
              )}
              {trackingStatus !== "finished" && (
                <TmdbScoreIndicator rating={tmdbRating} />
              )}
              {trackingStatus === "planned" && <WatchlistIndicator />}
            </div>
          </div>

          <div className="flex min-w-0 flex-col">
            <h4 className={cn(
              "line-clamp-2 text-xl font-black tracking-[-0.035em] text-foreground transition-colors group-hover:text-primary",
              compact ? "sm:text-xl lg:text-2xl" : "sm:text-2xl lg:text-3xl",
            )}>{displayTitle}</h4>
            <div className="mt-2.5 h-px w-20 bg-gradient-to-r from-primary via-primary/25 to-transparent" />

            <div className="mt-3 flex flex-wrap items-center gap-1.5">
              <TrackingStatusBadge status={trackingStatus} isArabic={isArabic} />
              {show.isAnime && <Badge className="h-8 rounded-full border border-chart-2/25 bg-chart-2/15 px-3 text-xs font-bold text-chart-2">{isArabic ? "أنمي" : "Anime"}</Badge>}
              {seasons != null && seasons > 0 && (
                <Badge variant="secondary" className="h-8 rounded-full border border-border/70 bg-secondary/60 px-3 text-xs font-semibold text-foreground/90">
                  {isArabic ? `${seasons} موسم` : `${seasons} season${seasons > 1 ? "s" : ""}`}
                </Badge>
              )}
            </div>

            {releasedEps != null && releasedEps > 0 && (
              <div className="tvtime-tracking-card__progress mt-3 rounded-xl border border-border/60 bg-muted/40 px-3 py-2.5">
                <div className="mb-1.5 flex items-center justify-between gap-3 text-xs font-bold text-muted-foreground">
                  <span>{isArabic ? "التقدم" : "Progress"}</span>
                  <span className="tabular-nums text-foreground">{watchedEps}/{releasedEps}</span>
                </div>
                <div className="h-1.5 overflow-hidden rounded-full bg-muted">
                  <div className="h-full rounded-full bg-primary" style={{ width: `${Math.min(100, Math.round((watchedEps / releasedEps) * 100))}%` }} />
                </div>
              </div>
            )}

            <div className="my-3.5 h-px bg-border/70" />

            <div className="grid grid-cols-3 divide-x divide-border/70">
              <ShowMetric icon={Clapperboard} value={totalEps != null ? (isArabic ? `${totalEps} حلقة` : `${totalEps} eps`) : "—"} label={isArabic ? "الحلقات" : "Episodes"} compact={compact} />
              <ShowMetric icon={CirclePlay} value={releasedEps != null ? (isArabic ? `${watchedEps}/${releasedEps} من الحلقات الصادرة` : `${watchedEps}/${releasedEps} released watched`) : (isArabic ? `${watchedEps} مشاهدة` : `${watchedEps} watched`)} label={isArabic ? "التقدم" : "Progress"} compact={compact} />
              <ShowMetric icon={Calendar} value={show.year || "—"} label={isArabic ? "سنة العرض" : "Released"} compact={compact} />
            </div>

            {userRating != null && (
              <div className="mt-3 flex items-center gap-2 rounded-xl border border-primary/15 bg-primary/5 px-3 py-2">
                <Star className="h-4 w-4 fill-primary text-primary" />
                <span className="text-xs font-bold text-primary">{isArabic ? "تقييمك" : "Your rating"}: {userRating}/100</span>
                <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted">
                  <div className="h-full rounded-full bg-primary" style={{ width: `${userRating}%` }} />
                </div>
              </div>
            )}

            <div className="my-3.5 h-px bg-border/70" />

            <div className={`flex min-h-12 items-center gap-3 rounded-xl border px-3 py-2.5 transition-colors sm:mt-auto ${activityTone}`}>
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border-2 border-current">
                <ActivityIcon className="h-4 w-4" />
              </span>
              <span className="min-w-0 flex-1 text-xs font-bold leading-snug sm:text-sm">{activity.text}</span>
              {isArabic
                ? <ChevronLeft className="h-6 w-6 shrink-0 transition-transform group-hover:-translate-x-1" />
                : <ChevronRight className="h-6 w-6 shrink-0 transition-transform group-hover:translate-x-1" />}
            </div>
          </div>
        </div>
      </Card>
    </motion.a>
  );
}

function ShowMetric({ icon: Icon, value, label, compact = false }: { icon: React.ElementType; value: React.ReactNode; label: string; compact?: boolean }) {
  return (
    <div className="flex min-w-0 items-center justify-center gap-1.5 px-1.5 first:pl-0 last:pr-0 sm:gap-2 sm:px-3">
      <Icon className={cn("h-3.5 w-3.5 shrink-0 text-primary", compact ? "sm:h-4 sm:w-4" : "sm:h-4 sm:w-4")} />
      <div className="min-w-0">
        <p className="truncate text-xs font-bold text-foreground/95">{value}</p>
        <p className="mt-0.5 truncate text-xs font-bold uppercase tracking-wide text-muted-foreground">{label}</p>
      </div>
    </div>
  );
}

// ============ SHARED COMPONENTS ============

function LibraryStat({ icon, label, value }: { icon: React.ReactNode; label: string; value: number | string }) {
  return (
    <Card className="tvtime-library-stat p-2 text-center">
      <span className="tvtime-library-stat__icon" aria-hidden="true">{icon}</span>
      <p className="text-lg font-bold text-primary">{value}</p>
      <p className="text-xs text-muted-foreground leading-tight">{label}</p>
    </Card>
  );
}
