"use client";

import { useStats, useTvTracking, useTvTrackingCounts, type TvTrackingCategory } from "@/hooks/use-tmdb";
import { useNav } from "@/lib/store";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { FilterPanel, FilterSection } from "@/components/ui/filter-panel";
import { SafeImage } from "@/components/media/safe-image";
import { WatchedIndicator } from "@/components/media/watched-indicator";
import { TmdbScoreIndicator } from "@/components/media/tmdb-score-indicator";
import { Play, Tv, Clock, Calendar, Clapperboard, BookOpen, Trophy, Star, Zap, Layers, PauseCircle, CirclePlay, ChevronLeft, ChevronRight, Grid2X2, List, CircleStop } from "lucide-react";
import { img } from "@/lib/tmdb";
import { cn } from "@/lib/utils";
import { motion } from "framer-motion";
import { useEffect, useState } from "react";


// Tracking status is calculated by the shared server engine.
type TrackingStatus = "planned" | "not_started" | "watching" | "uptodate" | "finished" | "stopped";

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
    return <Badge data-status="stopped" className="h-10 gap-2 rounded-full border border-rose-400/20 bg-rose-500/15 px-4 text-sm font-bold text-rose-300 shadow-[inset_0_1px_0_rgba(255,255,255,0.05)]"><CircleStop className="h-4 w-4" /> {isArabic ? "توقفت عن مشاهدته" : "Stopped Watching"}</Badge>;
  }
  if (status === "finished") {
    return <Badge data-status="finished" className="h-10 gap-2 rounded-full border border-emerald-400/20 bg-emerald-500/15 px-4 text-sm font-bold text-emerald-300 shadow-[inset_0_1px_0_rgba(255,255,255,0.05)]"><Trophy className="h-4 w-4" /> {isArabic ? "مكتمل" : "Finished"}</Badge>;
  }
  if (status === "uptodate") {
    return <Badge data-status="uptodate" className="h-10 gap-2 rounded-full border border-cyan-400/20 bg-cyan-500/15 px-4 text-sm font-bold text-cyan-300 shadow-[inset_0_1px_0_rgba(255,255,255,0.05)]"><Zap className="h-4 w-4" /> {isArabic ? "محدّث" : "Up To Date"}</Badge>;
  }
  if (status === "watching") {
    return <Badge data-status="watching" className="h-10 gap-2 rounded-full border border-blue-400/20 bg-blue-500/15 px-4 text-sm font-bold text-blue-300 shadow-[inset_0_1px_0_rgba(255,255,255,0.05)]"><Play className="h-4 w-4 fill-current" /> {isArabic ? "قيد المشاهدة" : "Watching"}</Badge>;
  }
  if (status === "planned") {
    return <Badge data-status="planned" className="h-10 gap-2 rounded-full border border-purple-400/20 bg-purple-500/15 px-4 text-sm font-bold text-purple-300 shadow-[inset_0_1px_0_rgba(255,255,255,0.05)]"><BookOpen className="h-4 w-4" /> {isArabic ? "قائمة المشاهدة" : "Planned"}</Badge>;
  }
  return <Badge data-status="not_started" className="h-10 gap-2 rounded-full border border-slate-400/20 bg-slate-500/15 px-4 text-sm font-bold text-slate-300 shadow-[inset_0_1px_0_rgba(255,255,255,0.05)]"><Clock className="h-4 w-4" /> {isArabic ? "لم يبدأ" : "Not Started"}</Badge>;
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
        <div className="view-page-header flex items-center gap-3">
          <div className="w-12 h-12 rounded-xl bg-primary/15 flex items-center justify-center">
            <Clapperboard className="w-6 h-6 text-primary" />
          </div>
          <div>
            <h1 className="view-page-title text-2xl sm:text-3xl font-extrabold tracking-tight">{isArabic ? "المسلسلات العربية" : world === "asian" ? "Asian TV Shows" : "TV Shows"}</h1>
            <p className="view-page-description text-sm text-muted-foreground mt-0.5">
              {isArabic
                ? "تتبّع مسلسلاتك العربية بصورة مستقلة عن المسلسلات العالمية والأنمي"
                : world === "asian"
                  ? "Asian series tracking, separated from standard TV, Arabic TV and Anime"
                  : "Your complete non-anime, non-Arabic, non-Asian TV tracking world"}
            </p>
          </div>
        </div>
      )}

      {/* TV Shows filters, all backed by full-collection counters. */}
      <div className="grid grid-cols-2 sm:grid-cols-4 xl:grid-cols-8 gap-3">
        <StatCard icon={<Layers className="w-5 h-5" />} label={isArabic ? "الكل" : "All"} value={counts?.all ?? "…"} color="from-purple-500/20 to-purple-500/5" />
        <StatCard icon={<BookOpen className="w-5 h-5" />} label={isArabic ? "قائمة المشاهدة" : "Watchlist"} value={counts?.watchlist ?? counts?.planned ?? "…"} color="from-violet-500/20 to-violet-500/5" />
        <StatCard icon={<Zap className="w-5 h-5" />} label={isArabic ? "محدّث" : "Up To Date"} value={counts?.uptodate ?? "…"} color="from-cyan-500/20 to-cyan-500/5" />
        <StatCard icon={<Trophy className="w-5 h-5" />} label={isArabic ? "مكتمل" : "Finished"} value={counts?.finished ?? "…"} color="from-emerald-500/20 to-emerald-500/5" />
        <StatCard icon={<CircleStop className="w-5 h-5" />} label={isArabic ? "توقفت عن مشاهدته" : "Stopped Watching"} value={counts?.stopped ?? "…"} color="from-rose-500/20 to-rose-500/5" />
        <StatCard icon={<Calendar className="w-5 h-5" />} label={isArabic ? "قادم" : "Upcoming"} value={counts?.upcoming ?? "…"} color="from-amber-500/20 to-amber-500/5" />
        <StatCard icon={<Play className="w-5 h-5" />} label={isArabic ? "لم أشاهده" : "Haven't Watched"} value={counts?.haventWatched ?? "…"} color="from-orange-500/20 to-orange-500/5" />
        <StatCard icon={<Clock className="w-5 h-5" />} label={isArabic ? "لم أبدأه" : "Haven't Started"} value={counts?.haventStarted ?? counts?.notStarted ?? "…"} color="from-slate-500/20 to-slate-500/5" />
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
  const [layout, setLayout] = useState<"list" | "grid">("list");
  const limit = 60;
  const tracking = useTvTracking({ category: filter, sortBy: "title", order: "asc", limit, offset: page * limit, world });

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
    { value: "watchlist", label: isArabic ? "قائمة المشاهدة" : "Watchlist", count: counts.watchlist ?? counts.planned, icon: <BookOpen className="w-3 h-3" />, color: "bg-purple-500/15 text-purple-400" },
    { value: "uptodate", label: isArabic ? "محدّث" : "Up To Date", count: counts.uptodate, icon: <Zap className="w-3 h-3" />, color: "bg-cyan-500/15 text-cyan-400" },
    { value: "finished", label: isArabic ? "مكتمل" : "Finished", count: counts.finished, icon: <Trophy className="w-3 h-3" />, color: "bg-emerald-500/15 text-emerald-400" },
    { value: "stopped", label: isArabic ? "توقفت عن مشاهدته" : "Stopped Watching", count: counts.stopped ?? 0, icon: <CircleStop className="w-3 h-3" />, color: "bg-rose-500/15 text-rose-300" },
    { value: "upcoming", label: isArabic ? "قادم" : "Upcoming", count: counts.upcoming, icon: <Calendar className="w-3 h-3" />, color: "bg-amber-500/15 text-amber-400" },
    { value: "havent-watched", label: isArabic ? "لم أشاهده" : "Haven't Watched", count: counts.haventWatched, icon: <Play className="w-3 h-3" />, color: "bg-orange-500/15 text-orange-400" },
    { value: "havent-started", label: isArabic ? "لم أبدأه" : "Haven't Started", count: counts.haventStarted ?? counts.notStarted, icon: <Clock className="w-3 h-3" />, color: "bg-slate-500/15 text-slate-300" },
    { value: "stale", label: isArabic ? "متوقف منذ 30 يوماً" : "Paused 30+ Days", count: counts.stale ?? 0, icon: <PauseCircle className="w-3 h-3" />, color: "bg-rose-500/15 text-rose-300" },
  ];

  const activeFilterLabel = filters.find((f) => f.value === filter)?.label ?? (isArabic ? "الكل" : "All");

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
        activeCount={filter === "all" ? 0 : 1}
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
      </FilterPanel>

      <div className="flex items-center justify-between gap-3 rounded-2xl border border-white/[0.07] bg-card/45 px-3 py-2.5">
        <div>
          <p className="text-sm font-bold text-foreground">{isArabic ? "طريقة عرض البطاقات" : "Card layout"}</p>
          <p className="text-[11px] text-muted-foreground">{isArabic ? "يُحفظ اختيارك تلقائياً" : "Your choice is saved automatically"}</p>
        </div>
        <div className="flex items-center rounded-xl border border-white/[0.08] bg-background/50 p-1" role="group" aria-label={isArabic ? "طريقة عرض بطاقات المسلسلات" : "TV card layout"}>
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
        <div className={cn("grid grid-cols-1 gap-4", layout === "grid" && "xl:grid-cols-2 min-[2100px]:grid-cols-3")}>
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className={cn("shimmer h-[440px] rounded-[28px] sm:h-[310px]", layout === "grid" && "xl:h-[370px]")} />
          ))}
        </div>
      ) : items.length === 0 ? (
        <EmptyTab
          icon={<Layers className="w-10 h-10" />}
          title={filter === "all" ? (isArabic ? "لا توجد مسلسلات عربية متابَعة بعد" : world === "asian" ? "No tracked Asian shows yet" : "No tracked shows yet") : (isArabic ? `لا توجد مسلسلات ضمن «${activeFilterLabel}»` : `No ${activeFilterLabel} shows`)}
          subtitle={filter === "all" ? (isArabic ? "أضف مسلسلاً عربياً إلى مكتبتك لتبدأ المتابعة" : world === "asian" ? "Follow an Asian TV show to start tracking" : "Follow TV shows to start tracking") : (isArabic ? "هذا الفلتر فارغ ضمن كامل مجموعة المسلسلات العربية" : `This filter is empty across your full ${world === "asian" ? "Asian TV" : "TV Shows"} collection`)}
        />
      ) : (
        <>
          <div className={cn("grid grid-cols-1 gap-4 sm:gap-5", layout === "grid" && "xl:grid-cols-2 min-[2100px]:grid-cols-3")}>
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
          : "border-white/[0.07] bg-background/35 text-muted-foreground hover:border-white/[0.13] hover:bg-muted/55 hover:text-foreground"
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
    ? "border-orange-400/15 bg-orange-500/[0.035] text-orange-400 group-hover:bg-orange-500/[0.07]"
    : activity.tone === "amber"
      ? "border-amber-400/15 bg-amber-500/[0.035] text-amber-300 group-hover:bg-amber-500/[0.07]"
      : activity.tone === "rose"
        ? "border-rose-400/15 bg-rose-500/[0.035] text-rose-300 group-hover:bg-rose-500/[0.07]"
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
        "group relative cursor-pointer overflow-hidden rounded-[28px] border-white/[0.14] bg-[radial-gradient(circle_at_15%_20%,rgba(139,92,246,0.07),transparent_30%),linear-gradient(145deg,rgba(21,25,36,0.98),rgba(10,14,23,0.98))] p-4 shadow-[0_18px_55px_rgba(0,0,0,0.28),inset_0_1px_0_rgba(255,255,255,0.03)] transition-[border-color,box-shadow,transform] duration-300 hover:-translate-y-0.5 hover:border-primary/30 hover:shadow-[0_24px_70px_rgba(0,0,0,0.4),0_0_28px_rgba(139,92,246,0.07)]",
        compact ? "sm:p-6" : "sm:p-[clamp(2rem,5vw,4.5rem)]",
      )}>
        <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(110deg,transparent_20%,rgba(255,255,255,0.018)_48%,transparent_72%)]" />
        <div className={cn(
          "relative flex flex-col gap-5 sm:grid sm:items-center",
          compact
            ? "sm:grid-cols-[clamp(112px,24%,150px)_minmax(0,1fr)] sm:gap-5"
            : "sm:grid-cols-[clamp(150px,24%,340px)_minmax(0,1fr)] sm:gap-[clamp(2rem,4.5vw,4.5rem)]",
        )}>
          <div className="relative aspect-[0.618/1] w-[112px] overflow-hidden rounded-[18px] border border-white/10 bg-muted shadow-[0_18px_35px_rgba(0,0,0,0.35)] sm:w-full sm:self-center">
          {show.poster ? (
            <SafeImage src={img(show.poster, "w342")} alt={show.title} fill variant="poster" className="transition-transform duration-500 group-hover:scale-[1.025]" />
          ) : (
            <div className="flex h-full w-full items-center justify-center"><Tv className="h-8 w-8 text-muted-foreground" /></div>
          )}
          {trackingStatus === "finished" && (
            <WatchedIndicator rating={userRating} status="finished" />
          )}
          {trackingStatus !== "finished" && (
            <TmdbScoreIndicator rating={tmdbRating} />
          )}
          </div>

          <div className="flex min-w-0 flex-col">
            <h4 className={cn(
              "line-clamp-2 text-2xl font-black tracking-[-0.035em] text-foreground transition-colors group-hover:text-white",
              compact ? "sm:text-2xl lg:text-3xl" : "sm:text-4xl lg:text-5xl",
            )}>{show.title}</h4>
            <div className="mt-4 h-px w-28 bg-gradient-to-r from-primary via-primary/25 to-transparent sm:mt-5" />

            <div className="mt-5 flex flex-wrap items-center gap-2 sm:mt-6">
              <TrackingStatusBadge status={trackingStatus} isArabic={isArabic} />
              {show.isAnime && <Badge className="h-10 rounded-full border border-purple-400/20 bg-purple-500/15 px-4 text-sm font-bold text-purple-300">Anime</Badge>}
              {seasons != null && seasons > 0 && (
                <Badge variant="secondary" className="h-10 rounded-full border border-white/[0.07] bg-white/[0.06] px-4 text-sm font-semibold text-foreground/90">
                  {isArabic ? `${seasons} موسم` : `${seasons} season${seasons > 1 ? "s" : ""}`}
                </Badge>
              )}
            </div>

            <div className={cn("my-5 h-px bg-white/[0.12]", compact ? "sm:my-5" : "sm:my-7")} />

            <div className="grid grid-cols-1 divide-y divide-white/[0.1] min-[420px]:grid-cols-[1fr_2fr_1fr] min-[420px]:divide-x min-[420px]:divide-y-0">
              <ShowMetric icon={Clapperboard} value={totalEps != null ? (isArabic ? `${totalEps} حلقة` : `${totalEps} eps`) : "—"} label={isArabic ? "الحلقات" : "Episodes"} compact={compact} />
              <ShowMetric icon={CirclePlay} value={releasedEps != null ? (isArabic ? `${watchedEps}/${releasedEps} من الحلقات الصادرة` : `${watchedEps}/${releasedEps} released watched`) : (isArabic ? `${watchedEps} مشاهدة` : `${watchedEps} watched`)} label={isArabic ? "التقدم" : "Progress"} compact={compact} />
              <ShowMetric icon={Calendar} value={show.year || "—"} label={isArabic ? "سنة العرض" : "Released"} compact={compact} />
            </div>

            {userRating != null && (
              <div className="mt-5 flex items-center gap-3 rounded-xl border border-emerald-400/10 bg-emerald-400/[0.04] px-4 py-2.5">
                <Star className="h-4 w-4 fill-emerald-400 text-emerald-400" />
                <span className="text-sm font-bold text-emerald-300">{isArabic ? "تقييمك" : "Your rating"}: {userRating}/100</span>
                <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-white/[0.07]">
                  <div className="h-full rounded-full bg-emerald-400" style={{ width: `${userRating}%` }} />
                </div>
              </div>
            )}

            <div className={cn("my-5 h-px bg-white/[0.12]", compact ? "sm:my-5" : "sm:my-7")} />

            <div className={`flex min-h-14 items-center gap-4 rounded-2xl border px-4 py-3 transition-colors sm:mt-auto ${activityTone}`}>
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border-2 border-current">
                <ActivityIcon className="h-5 w-5" />
              </span>
              <span className="min-w-0 flex-1 text-sm font-bold leading-snug sm:text-base">{activity.text}</span>
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
    <div className="flex items-center gap-3 py-3 first:pt-0 last:pb-0 min-[420px]:justify-center min-[420px]:px-3 min-[420px]:py-0 first:min-[420px]:pl-0 last:min-[420px]:pr-0">
      <Icon className={cn("h-5 w-5 shrink-0 text-primary", compact ? "sm:h-5 sm:w-5" : "sm:h-6 sm:w-6")} />
      <div className="min-w-0">
        <p className={cn("truncate text-sm font-bold text-foreground/95", compact ? "sm:text-xs" : "sm:text-base")}>{value}</p>
        <p className="mt-0.5 text-[10px] font-bold uppercase tracking-[0.12em] text-muted-foreground">{label}</p>
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
