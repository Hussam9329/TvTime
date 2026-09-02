"use client";

import { useStats, useTvTracking, useTvTrackingCounts, type TvTrackingCategory } from "@/hooks/use-tmdb";
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
import { Play, Tv, Clock, Calendar, Clapperboard, BookOpen, Trophy, Star, Zap, Layers, PauseCircle, CirclePlay, ChevronLeft, ChevronRight, Grid2X2, List, CircleStop, Search, ArrowUpDown } from "lucide-react";
import { img, pickArabicTitle } from "@/lib/tmdb";
import { cn } from "@/lib/utils";
import { motion } from "framer-motion";
import { useEffect, useState } from "react";
import { PageTitlebar } from "@/components/ui/page-titlebar";


// Tracking status is calculated by the shared server engine.
type TrackingStatus = "planned" | "not_started" | "watching" | "uptodate" | "finished" | "stopped";

const TV_GENRES = [
  "Action & Adventure", "Animation", "Comedy", "Crime", "Documentary", "Drama",
  "Family", "Kids", "Mystery", "News", "Reality", "Sci-Fi & Fantasy",
  "Soap", "Talk", "War & Politics", "Western",
] as const;

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
  if (status === "stopped") {
    return <Badge data-status="stopped" className="h-8 gap-1.5 rounded-full border border-rose-400/20 bg-rose-500/15 px-3 text-xs font-bold text-rose-700 dark:text-rose-300 shadow-[inset_0_1px_0_rgba(255,255,255,0.05)]"><CircleStop className="h-3.5 w-3.5" /> {isArabic ? "توقفت عن مشاهدته" : "Stopped Watching"}</Badge>;
  }
  if (status === "finished") {
    return <Badge data-status="finished" className="h-8 gap-1.5 rounded-full border border-emerald-400/20 bg-emerald-500/15 px-3 text-xs font-bold text-emerald-700 dark:text-emerald-300 shadow-[inset_0_1px_0_rgba(255,255,255,0.05)]"><Trophy className="h-3.5 w-3.5" /> {isArabic ? "مكتمل" : "Finished"}</Badge>;
  }
  if (status === "uptodate") {
    return <Badge data-status="uptodate" className="h-8 gap-1.5 rounded-full border border-cyan-400/20 bg-cyan-500/15 px-3 text-xs font-bold text-cyan-700 dark:text-cyan-300 shadow-[inset_0_1px_0_rgba(255,255,255,0.05)]"><Zap className="h-3.5 w-3.5" /> {isArabic ? "محدّث" : "Up To Date"}</Badge>;
  }
  if (status === "watching") {
    return <Badge data-status="watching" className="h-8 gap-1.5 rounded-full border border-blue-400/20 bg-blue-500/15 px-3 text-xs font-bold text-blue-700 dark:text-blue-300 shadow-[inset_0_1px_0_rgba(255,255,255,0.05)]"><Play className="h-3.5 w-3.5 fill-current" /> {isArabic ? "قيد المشاهدة" : "Watching"}</Badge>;
  }
  if (status === "planned") {
    return <Badge data-status="planned" className="h-8 gap-1.5 rounded-full border border-purple-400/20 bg-purple-500/15 px-3 text-xs font-bold text-purple-700 dark:text-purple-300 shadow-[inset_0_1px_0_rgba(255,255,255,0.05)]"><BookOpen className="h-3.5 w-3.5" /> {isArabic ? "قائمة المشاهدة" : "Planned"}</Badge>;
  }
  return <Badge data-status="not_started" className="h-8 gap-1.5 rounded-full border border-slate-400/20 bg-slate-500/15 px-3 text-xs font-bold text-slate-600 dark:text-slate-300 shadow-[inset_0_1px_0_rgba(255,255,255,0.05)]"><Clock className="h-3.5 w-3.5" /> {isArabic ? "لم يبدأ" : "Not Started"}</Badge>;
}

export function TvShowsView({ world = "standard", embedded = false }: { world?: "standard" | "arabic" | "asian"; embedded?: boolean }) {
  const stats = useStats();
  const trackingCounts = useTvTrackingCounts(world);
  const counts = trackingCounts.data?.counts;
  const goTv = useNav((s) => s.goTv);
  const isArabic = world === "arabic";

  return (
    <div className="tvtime-tv-tracking-page space-y-5">
      {!embedded && (
        <PageTitlebar title={isArabic ? "المسلسلات العربية" : world === "asian" ? "Asian TV Shows" : "TV Shows"} />
      )}

      {/* TV Shows filters, all backed by full-collection counters. */}
      <div className="tvtime-tv-library-stats grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard icon={<Play className="w-5 h-5" />} label={isArabic ? "قيد المشاهدة" : "Watching"} value={counts?.watching ?? "…"} color="from-blue-500/20 to-blue-500/5" />
        <StatCard icon={<BookOpen className="w-5 h-5" />} label={isArabic ? "قائمة المشاهدة" : "Watchlist"} value={counts?.watchlist ?? counts?.planned ?? "…"} color="from-violet-500/20 to-violet-500/5" />
        <StatCard icon={<Zap className="w-5 h-5" />} label={isArabic ? "محدّث" : "Up To Date"} value={counts?.uptodate ?? "…"} color="from-cyan-500/20 to-cyan-500/5" />
        <StatCard icon={<Trophy className="w-5 h-5" />} label={isArabic ? "مكتمل" : "Finished"} value={counts?.finished ?? "…"} color="from-emerald-500/20 to-emerald-500/5" />
      </div>

      {stats.data?.watchTime && (
        <p className="text-xs text-muted-foreground px-1 -mt-2">
          {isArabic ? (
            <>إجمالي وقت المشاهدة: <strong>{stats.data.watchTime.totalHours || 0} ساعة</strong>. العدّادات محسوبة من كامل المجموعة وليست من الصفحة الحالية.</>
          ) : (
            <>Total watch time: <strong>{stats.data.watchTime.totalHours || 0}h</strong>. Filter counters below are full-collection counters, not current-page counters.</>
          )}
        </p>
      )}

      <AllShowsTab onGo={goTv} globalCounts={counts} world={world} />
    </div>
  );
}

// ============ TAB COMPONENTS ============

// "All" tab — shows every tracked series, each badged with its current tracking
// status (Finished / Up To Date / Watching / Not Started / Planned). Includes quick filter chips so the
// user can drill into a specific status without leaving the tab.
function AllShowsTab({ onGo, globalCounts, world }: { onGo: (id: number) => void; globalCounts?: any; world: "standard" | "arabic" | "asian" }) {
  const [page, setPage] = useState(0);
  const [filter, setFilter] = useState<TvTrackingCategory>("all");
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [genre, setGenre] = useState("");
  const [sortBy, setSortBy] = useState<"title" | "addedAt" | "watchedAt">("title");
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
    { value: "all", label: isArabic ? "الكل" : "All", count: counts.all, icon: <Layers className="w-3 h-3" />, color: "bg-primary/15 text-primary" },
    { value: "watchlist", label: isArabic ? "قائمة المشاهدة" : "Watchlist", count: counts.watchlist ?? counts.planned, icon: <BookOpen className="w-3 h-3" />, color: "bg-purple-500/15 text-purple-700 dark:text-purple-400" },
    { value: "uptodate", label: isArabic ? "محدّث" : "Up To Date", count: counts.uptodate, icon: <Zap className="w-3 h-3" />, color: "bg-cyan-500/15 text-cyan-700 dark:text-cyan-400" },
    { value: "finished", label: isArabic ? "مكتمل" : "Finished", count: counts.finished, icon: <Trophy className="w-3 h-3" />, color: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400" },
    { value: "stopped", label: isArabic ? "توقفت عن مشاهدته" : "Stopped Watching", count: counts.stopped ?? 0, icon: <CircleStop className="w-3 h-3" />, color: "bg-rose-500/15 text-rose-700 dark:text-rose-300" },
    { value: "upcoming", label: isArabic ? "قادم" : "Upcoming", count: counts.upcoming, icon: <Calendar className="w-3 h-3" />, color: "bg-amber-500/15 text-amber-700 dark:text-amber-400" },
    { value: "havent-watched", label: isArabic ? "لم أشاهده" : "Haven't Watched", count: counts.haventWatched, icon: <Play className="w-3 h-3" />, color: "bg-orange-500/15 text-orange-700 dark:text-orange-400" },
    { value: "havent-started", label: isArabic ? "لم أبدأه" : "Haven't Started", count: counts.haventStarted ?? counts.notStarted, icon: <Clock className="w-3 h-3" />, color: "bg-slate-500/15 text-slate-600 dark:text-slate-300" },
    { value: "stale", label: isArabic ? "متوقف منذ 30 يوماً" : "Paused 30+ Days", count: counts.stale ?? 0, icon: <PauseCircle className="w-3 h-3" />, color: "bg-rose-500/15 text-rose-700 dark:text-rose-300" },
  ];

  const activeFilterLabel = filters.find((f) => f.value === filter)?.label ?? (isArabic ? "الكل" : "All");
  const activeFilterCount = Number(filter !== "all") + Number(search.trim() !== "") + Number(genre !== "") + Number(sortBy !== "title");

  const resetFilters = () => {
    setFilter("all");
    setSearch("");
    setDebouncedSearch("");
    setGenre("");
    setSortBy("title");
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
    <div className="space-y-4">
      <FilterPanel
        title={(
          <span className="flex flex-wrap items-center gap-2">
            <span>{isArabic ? "كل المسلسلات العربية" : world === "asian" ? "All Asian TV Shows" : "All TV Shows"}</span>
            <span className="text-xs font-normal text-muted-foreground">({total})</span>
            <Badge variant="secondary" className="h-5 text-[10px]">{isArabic ? "عدّادات المجموعة" : "Global counters"}</Badge>
          </span>
        )}
        description={isArabic
          ? "استخدم هذه الفلاتر داخل مكتبتك العربية. كل رقم محسوب من كامل مجموعة المسلسلات العربية فقط، وليس من الصفحة الحالية أو بقية الأقسام."
          : world === "asian"
            ? "Every number is calculated across your Asian TV collection only, separate from standard TV, Arabic TV and Anime."
            : "Use these filters from inside All. Every number is calculated across your complete TV Shows collection, never from Arabic TV, Asian TV, Anime or only the visible page."}
        activeCount={activeFilterCount}
        onReset={resetFilters}
        resetLabel={isArabic ? "إعادة الضبط" : "Reset all"}
      >
        <FilterSection title={isArabic ? "البحث والنوع والترتيب" : "Search, genre and sort"}>
          <FilterGrid className="lg:grid-cols-[minmax(0,1fr)_220px_260px]">
            <FilterField label={isArabic ? "البحث في المسلسلات" : "Search TV Shows"}>
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={search}
                  onChange={(event) => { setSearch(event.target.value); setPage(0); }}
                  placeholder={isArabic ? "ابحث باسم المسلسل..." : "Search your shows..."}
                  className="h-9 pl-9"
                  aria-label={isArabic ? "البحث في المسلسلات" : "Search TV Shows"}
                />
              </div>
            </FilterField>

            <FilterField label={isArabic ? "النوع" : "Genre"}>
              <Select
                value={genre || "all"}
                onValueChange={(value) => {
                  setGenre(value === "all" ? "" : value);
                  setPage(0);
                }}
              >
                <SelectTrigger className="h-9 w-full" aria-label={isArabic ? "فلتر نوع المسلسلات" : "Filter TV Shows by genre"}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{isArabic ? "كل الأنواع" : "All Genres"}</SelectItem>
                  {TV_GENRES.map((item) => (
                    <SelectItem key={item} value={item}>{item}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </FilterField>

            <FilterField label={isArabic ? "الترتيب حسب" : "Sort by"}>
              <div className="relative">
                <ArrowUpDown className="pointer-events-none absolute left-3 top-1/2 z-10 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Select
                  value={sortBy}
                  onValueChange={(value) => {
                    setSortBy(value as "title" | "addedAt" | "watchedAt");
                    setPage(0);
                  }}
                >
                  <SelectTrigger className="h-9 w-full pl-9" aria-label={isArabic ? "ترتيب المسلسلات" : "Sort TV Shows"}>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="title">{isArabic ? "العنوان أ-ي" : "Title A-Z"}</SelectItem>
                    <SelectItem value="addedAt">{isArabic ? "المضافة حديثاً" : "Recently Added"}</SelectItem>
                    <SelectItem value="watchedAt">{isArabic ? "آخر مشاهدة" : "Last Watched"}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </FilterField>
          </FilterGrid>
        </FilterSection>

        <FilterSection title={isArabic ? "حالة المتابعة" : "Tracking status"} divided>
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
      </FilterPanel>

      <div className="flex items-center justify-between gap-3 rounded-2xl border border-border/60 bg-card/60 px-3 py-2.5">
        <div>
          <p className="text-sm font-bold text-foreground">{isArabic ? "طريقة عرض البطاقات" : "Card layout"}</p>
          <p className="text-[11px] text-muted-foreground">{isArabic ? "يُحفظ اختيارك تلقائياً" : "Your choice is saved automatically"}</p>
        </div>
        <div className="flex items-center rounded-xl border border-border/70 bg-background/60 p-1" role="group" aria-label={isArabic ? "طريقة عرض بطاقات المسلسلات" : "TV card layout"}>
          <Button
            type="button"
            size="sm"
            variant={layout === "list" ? "default" : "ghost"}
            className="h-8 gap-1.5 rounded-lg px-3"
            onClick={() => changeLayout("list")}
            aria-pressed={layout === "list"}
          >
            <List className="h-3.5 w-3.5" /> {isArabic ? "قائمة" : "List"}
          </Button>
          <Button
            type="button"
            size="sm"
            variant={layout === "grid" ? "default" : "ghost"}
            className="h-8 gap-1.5 rounded-lg px-3"
            onClick={() => changeLayout("grid")}
            aria-pressed={layout === "grid"}
          >
            <Grid2X2 className="h-3.5 w-3.5" /> {isArabic ? "شبكة" : "Grid"}
          </Button>
        </div>
      </div>

      {tracking.isLoading ? (
        <div className={cn("grid grid-cols-1 gap-4", layout === "grid" && "lg:grid-cols-2 min-[2100px]:grid-cols-3")}>
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="shimmer h-[300px] rounded-[24px] sm:h-[280px]" />
          ))}
        </div>
      ) : items.length === 0 ? (
        <EmptyTab
          icon={<Layers className="w-10 h-10" />}
          title={search.trim()
            ? (isArabic ? `لا توجد نتائج لـ «${search.trim()}»` : `No results for “${search.trim()}”`)
            : filter === "all"
              ? (isArabic ? "لا توجد مسلسلات عربية متابَعة بعد" : world === "asian" ? "No tracked Asian shows yet" : "No tracked shows yet")
              : (isArabic ? `لا توجد مسلسلات ضمن «${activeFilterLabel}»` : `No ${activeFilterLabel} shows`)}
          subtitle={search.trim()
            ? (isArabic ? "جرّب اسماً مختلفاً أو أعد ضبط الفلاتر." : "Try another title or reset the filters.")
            : filter === "all"
              ? (isArabic ? "أضف مسلسلاً عربياً إلى مكتبتك لتبدأ المتابعة" : world === "asian" ? "Follow an Asian TV show to start tracking" : "Follow TV shows to start tracking")
              : (isArabic ? "هذا الفلتر فارغ ضمن كامل مجموعة المسلسلات العربية" : `This filter is empty across your full ${world === "asian" ? "Asian TV" : "TV Shows"} collection`)}
        />
      ) : (
        <>
          <div className={cn("grid grid-cols-1 gap-4 sm:gap-5", layout === "grid" && "lg:grid-cols-2 min-[2100px]:grid-cols-3")}>
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
          ? `${color} border-current/30 shadow-[0_8px_22px_rgba(0,0,0,0.16)]`
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
    ? { tone: "rose", text: isArabic ? "توقفت عن المشاهدة — تم حفظ تقدمك" : "Stopped watching — progress saved", icon: CircleStop }
    : show._hasUnwatchedReleasedEpisode
      ? { tone: "orange", text: isArabic ? "توجد حلقة صادرة بانتظارك — تابع المشاهدة" : "Released episode waiting — continue watching", icon: CirclePlay }
    : show._nextEpisodeAirDate
      ? {
          tone: "amber",
          text: `${isArabic ? "القادمة" : "Upcoming"}: ${show._nextEpisodeSeasonNumber ? `S${show._nextEpisodeSeasonNumber}` : ""}${show._nextEpisodeNumber ? `E${show._nextEpisodeNumber}` : ""}${show._nextEpisodeName ? ` · ${show._nextEpisodeName}` : ""} · ${new Date(show._nextEpisodeAirDate).toLocaleDateString(isArabic ? "ar-IQ" : "en-US", { month: "short", day: "numeric", year: "numeric" })}`,
          icon: Calendar,
        }
      : show._daysSinceLastWatch != null && show._daysSinceLastWatch >= 30 && trackingStatus !== "finished"
        ? { tone: "rose", text: isArabic ? `آخر مشاهدة قبل ${show._daysSinceLastWatch} يوماً` : `Last watched ${show._daysSinceLastWatch} days ago`, icon: PauseCircle }
        : { tone: "primary", text: isArabic ? "فتح تفاصيل المسلسل" : "Open series details", icon: Tv };
  const ActivityIcon = activity.icon;
  const activityTone = activity.tone === "orange"
    ? "border-orange-400/15 bg-orange-500/[0.035] text-orange-600 dark:text-orange-400 group-hover:bg-orange-500/[0.07]"
    : activity.tone === "amber"
      ? "border-amber-400/15 bg-amber-500/[0.035] text-amber-600 dark:text-amber-300 group-hover:bg-amber-500/[0.07]"
      : activity.tone === "rose"
        ? "border-rose-400/15 bg-rose-500/[0.035] text-rose-600 dark:text-rose-300 group-hover:bg-rose-500/[0.07]"
        : "border-primary/15 bg-primary/[0.035] text-primary group-hover:bg-primary/[0.07]";

  return (
    <motion.a
      href={show.tmdbId ? `/tv/${show.tmdbId}` : undefined}
      dir={isArabic ? "rtl" : undefined}
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      onClick={(event) => { if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return; event.preventDefault(); onGo(); }}
      className="block rounded-[28px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/70"
    >
      <Card className={cn(
        "group relative cursor-pointer overflow-hidden rounded-[24px] border-white/[0.14] bg-[radial-gradient(circle_at_15%_20%,rgba(139,92,246,0.07),transparent_30%),linear-gradient(145deg,rgba(21,25,36,0.98),rgba(10,14,23,0.98))] p-3.5 shadow-[0_18px_55px_rgba(0,0,0,0.28),inset_0_1px_0_rgba(255,255,255,0.03)] transition-[border-color,box-shadow,transform] duration-300 hover:-translate-y-0.5 hover:border-primary/30 hover:shadow-[0_24px_70px_rgba(0,0,0,0.4),0_0_28px_rgba(139,92,246,0.07)] sm:p-5",
      )}>
        <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(110deg,transparent_20%,rgba(255,255,255,0.018)_48%,transparent_72%)]" />
        <div className={cn(
          "relative grid grid-cols-[92px_minmax(0,1fr)] items-start gap-3.5 sm:items-center",
          compact
            ? "sm:grid-cols-[clamp(105px,23%,135px)_minmax(0,1fr)] sm:gap-5"
            : "sm:grid-cols-[clamp(125px,20%,175px)_minmax(0,1fr)] sm:gap-6",
        )}>
          <div className="relative aspect-[0.618/1] w-full overflow-hidden rounded-[16px] border border-border/60 bg-muted shadow-md sm:self-center">
          {show.poster ? (
            <SafeImage src={img(show.poster, "w342")} alt={displayTitle} fill variant="poster" className="transition-transform duration-500 group-hover:scale-[1.025]" />
          ) : (
            <div className="flex h-full w-full items-center justify-center"><Tv className="h-8 w-8 text-muted-foreground" /></div>
          )}
          {trackingStatus === "finished" && (
            <WatchedIndicator rating={userRating} status="finished" />
          )}
          {trackingStatus !== "finished" && (
            <TmdbScoreIndicator rating={tmdbRating} />
          )}
          {trackingStatus === "planned" && <WatchlistIndicator />}
          </div>

          <div className="flex min-w-0 flex-col">
            <h4 className={cn(
              "line-clamp-2 text-xl font-black tracking-[-0.035em] text-foreground transition-colors group-hover:text-primary",
              compact ? "sm:text-xl lg:text-2xl" : "sm:text-2xl lg:text-3xl",
            )}>{displayTitle}</h4>
            <div className="mt-2.5 h-px w-20 bg-gradient-to-r from-primary via-primary/25 to-transparent" />

            <div className="mt-3 flex flex-wrap items-center gap-1.5">
              <TrackingStatusBadge status={trackingStatus} isArabic={isArabic} />
              {show.isAnime && <Badge className="h-8 rounded-full border border-purple-400/20 bg-purple-500/15 px-3 text-xs font-bold text-purple-700 dark:text-purple-300">Anime</Badge>}
              {seasons != null && seasons > 0 && (
                <Badge variant="secondary" className="h-8 rounded-full border border-border/70 bg-secondary/60 px-3 text-xs font-semibold text-foreground/90">
                  {isArabic ? `${seasons} موسم` : `${seasons} season${seasons > 1 ? "s" : ""}`}
                </Badge>
              )}
            </div>

            {releasedEps != null && releasedEps > 0 && (
              <div className="mt-3 rounded-xl border border-border/60 bg-muted/40 px-3 py-2.5">
                <div className="mb-1.5 flex items-center justify-between gap-3 text-[11px] font-bold text-muted-foreground">
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
              <div className="mt-3 flex items-center gap-2 rounded-xl border border-emerald-400/10 bg-emerald-400/[0.04] px-3 py-2">
                <Star className="h-4 w-4 fill-emerald-400 text-emerald-400" />
                <span className="text-xs font-bold text-emerald-700 dark:text-emerald-300">{isArabic ? "تقييمك" : "Your rating"}: {userRating}/100</span>
                <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted">
                  <div className="h-full rounded-full bg-emerald-400" style={{ width: `${userRating}%` }} />
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
        <p className="truncate text-[10px] font-bold text-foreground/95 sm:text-xs">{value}</p>
        <p className="mt-0.5 truncate text-[8px] font-bold uppercase tracking-[0.08em] text-muted-foreground sm:text-[9px]">{label}</p>
      </div>
    </div>
  );
}

function EmptyTab({ icon, title, subtitle }: { icon: React.ReactNode; title: string; subtitle: string }) {
  return (
    <Card className="p-12 text-center text-muted-foreground">
      <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-primary/20 to-primary/5 mx-auto mb-3 flex items-center justify-center text-primary border border-primary/20">
        {icon}
      </div>
      <p className="font-semibold text-foreground text-lg">{title}</p>
      <p className="text-sm mt-1">{subtitle}</p>
    </Card>
  );
}

// ============ SHARED COMPONENTS ============

function StatCard({ icon, label, value, suffix, color }: { icon: React.ReactNode; label: string; value: number | string; suffix?: string; color: string }) {
  return (
    <Card className={`p-4 relative overflow-hidden bg-gradient-to-br ${color}`}>
      <div className="relative">
        <div className="w-9 h-9 rounded-lg bg-background/50 backdrop-blur flex items-center justify-center text-primary mb-2">{icon}</div>
        <p className="text-2xl font-extrabold">{value}{suffix && value !== "…" && <span className="text-sm text-muted-foreground font-normal">{suffix}</span>}</p>
        <p className="text-xs text-muted-foreground">{label}</p>
      </div>
    </Card>
  );
}
