"use client";

import { useStats, useTvTracking, useTvTrackingCounts, type TvTrackingCategory } from "@/hooks/use-tmdb";
import { useNav } from "@/lib/store";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { FilterPanel, FilterSection } from "@/components/ui/filter-panel";
import { SafeImage } from "@/components/media/safe-image";
import { Play, Tv, Clock, Calendar, Clapperboard, BookOpen, Trophy, Star, Zap, Layers } from "lucide-react";
import { img } from "@/lib/tmdb";
import { motion } from "framer-motion";
import { useState } from "react";


// Tracking status is calculated by the shared server engine.
type TrackingStatus = "planned" | "not_started" | "watching" | "uptodate" | "finished";

function deriveTrackingStatus(show: any): TrackingStatus {
  const value = String(show?._trackingStatus || show?.status || "not_started").toLowerCase();
  if (value === "finished") {
    if (show?._isEndedByTmdb === true) return "finished";
    return show?._hasUnwatchedReleasedEpisode ? "watching" : "uptodate";
  }
  if (value === "planned" || value === "not_started" || value === "watching" || value === "uptodate") {
    return value;
  }
  if (value === "watched") return show?._isEndedByTmdb === true ? "finished" : "uptodate";
  return "not_started";
}

function TrackingStatusBadge({ status }: { status: TrackingStatus }) {
  if (status === "finished") {
    return <Badge data-status="finished" className="text-[9px] bg-emerald-500/20 text-emerald-400 border-0"><Trophy className="w-2.5 h-2.5 mr-1" /> Finished</Badge>;
  }
  if (status === "uptodate") {
    return <Badge data-status="uptodate" className="text-[9px] bg-cyan-500/20 text-cyan-400 border-0"><Zap className="w-2.5 h-2.5 mr-1" /> Up To Date</Badge>;
  }
  if (status === "watching") {
    return <Badge data-status="watching" className="text-[9px] bg-blue-500/20 text-blue-400 border-0"><Play className="w-2.5 h-2.5 mr-1" /> Watching</Badge>;
  }
  if (status === "planned") {
    return <Badge data-status="planned" className="text-[9px] bg-purple-500/20 text-purple-400 border-0"><BookOpen className="w-2.5 h-2.5 mr-1" /> Planned</Badge>;
  }
  return <Badge data-status="not_started" className="text-[9px] bg-slate-500/20 text-slate-300 border-0"><Clock className="w-2.5 h-2.5 mr-1" /> Not Started</Badge>;
}

export function TvShowsView({ world = "standard", embedded = false }: { world?: "standard" | "arabic"; embedded?: boolean }) {
  const stats = useStats();
  const trackingCounts = useTvTrackingCounts(world);
  const counts = trackingCounts.data?.counts;
  const goTv = useNav((s) => s.goTv);

  return (
    <div className="tvtime-tv-tracking-page space-y-5">
      {!embedded && (
        <div className="view-page-header flex items-center gap-3">
          <div className="w-12 h-12 rounded-xl bg-primary/15 flex items-center justify-center">
            <Clapperboard className="w-6 h-6 text-primary" />
          </div>
          <div>
            <h1 className="view-page-title text-2xl sm:text-3xl font-extrabold tracking-tight">{world === "arabic" ? "Arabic TV Shows" : "TV Shows"}</h1>
            <p className="view-page-description text-sm text-muted-foreground mt-0.5">
              {world === "arabic"
                ? "Arabic-language series tracking, fully separated from TV Shows and Anime"
                : "Your complete non-anime, non-Arabic TV tracking world, with global counts across every show"}
            </p>
          </div>
        </div>
      )}

      {/* TV Shows filters, all backed by full-collection counters. */}
      <div className="grid grid-cols-2 sm:grid-cols-4 xl:grid-cols-7 gap-3">
        <StatCard icon={<Layers className="w-5 h-5" />} label="All" value={counts?.all ?? "…"} color="from-purple-500/20 to-purple-500/5" />
        <StatCard icon={<BookOpen className="w-5 h-5" />} label="Watchlist" value={counts?.watchlist ?? counts?.planned ?? "…"} color="from-violet-500/20 to-violet-500/5" />
        <StatCard icon={<Zap className="w-5 h-5" />} label="Up To Date" value={counts?.uptodate ?? "…"} color="from-cyan-500/20 to-cyan-500/5" />
        <StatCard icon={<Trophy className="w-5 h-5" />} label="Finished" value={counts?.finished ?? "…"} color="from-emerald-500/20 to-emerald-500/5" />
        <StatCard icon={<Calendar className="w-5 h-5" />} label="Upcoming" value={counts?.upcoming ?? "…"} color="from-amber-500/20 to-amber-500/5" />
        <StatCard icon={<Play className="w-5 h-5" />} label="Haven't Watched" value={counts?.haventWatched ?? "…"} color="from-orange-500/20 to-orange-500/5" />
        <StatCard icon={<Clock className="w-5 h-5" />} label="Haven't Started" value={counts?.haventStarted ?? counts?.notStarted ?? "…"} color="from-slate-500/20 to-slate-500/5" />
      </div>

      {stats.data?.watchTime && (
        <p className="text-xs text-muted-foreground px-1 -mt-2">
          Total watch time: <strong>{stats.data.watchTime.totalHours || 0}h</strong>. Filter counters below are full-collection counters, not current-page counters.
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
function AllShowsTab({ onGo, globalCounts, world }: { onGo: (id: number) => void; globalCounts?: any; world: "standard" | "arabic" }) {
  const [page, setPage] = useState(0);
  const [filter, setFilter] = useState<TvTrackingCategory>("all");
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
    upcoming: 0,
    haventWatched: 0,
    haventStarted: 0,
  };
  const totalPages = Math.ceil(total / limit);

  const filters: {
    value: TvTrackingCategory;
    label: string;
    count: number;
    icon?: React.ReactNode;
    color: string;
  }[] = [
    { value: "all", label: "All", count: counts.all, icon: <Layers className="w-3 h-3" />, color: "bg-primary/15 text-primary" },
    { value: "watchlist", label: "Watchlist", count: counts.watchlist ?? counts.planned, icon: <BookOpen className="w-3 h-3" />, color: "bg-purple-500/15 text-purple-400" },
    { value: "uptodate", label: "Up To Date", count: counts.uptodate, icon: <Zap className="w-3 h-3" />, color: "bg-cyan-500/15 text-cyan-400" },
    { value: "finished", label: "Finished", count: counts.finished, icon: <Trophy className="w-3 h-3" />, color: "bg-emerald-500/15 text-emerald-400" },
    { value: "upcoming", label: "Upcoming", count: counts.upcoming, icon: <Calendar className="w-3 h-3" />, color: "bg-amber-500/15 text-amber-400" },
    { value: "havent-watched", label: "Haven't Watched", count: counts.haventWatched, icon: <Play className="w-3 h-3" />, color: "bg-orange-500/15 text-orange-400" },
    { value: "havent-started", label: "Haven't Started", count: counts.haventStarted ?? counts.notStarted, icon: <Clock className="w-3 h-3" />, color: "bg-slate-500/15 text-slate-300" },
  ];

  const activeFilterLabel = filters.find((f) => f.value === filter)?.label ?? "All";

  return (
    <div className="space-y-4">
      <FilterPanel
        title={(
          <span className="flex flex-wrap items-center gap-2">
            <span>{world === "arabic" ? "All Arabic TV Shows" : "All TV Shows"}</span>
            <span className="text-xs font-normal text-muted-foreground">({total})</span>
            <Badge variant="secondary" className="h-5 text-[10px]">Global counters</Badge>
          </span>
        )}
        description={world === "arabic"
          ? "Use these filters from inside All. Every number is calculated across your complete Arabic TV collection only, never from standard TV Shows, Anime or the visible page."
          : "Use these filters from inside All. Every number is calculated across your complete TV Shows collection, never from Arabic TV, Anime or only the visible page."}
        activeCount={filter === "all" ? 0 : 1}
      >
        <FilterSection title="Tracking status">
          <div className="flex flex-wrap items-center gap-2">
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

      {tracking.isLoading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {Array.from({ length: 12 }).map((_, i) => (
            <div key={i} className="h-[110px] shimmer rounded-lg" />
          ))}
        </div>
      ) : items.length === 0 ? (
        <EmptyTab
          icon={<Layers className="w-10 h-10" />}
          title={filter === "all" ? (world === "arabic" ? "No tracked Arabic shows yet" : "No tracked shows yet") : `No ${activeFilterLabel} shows`}
          subtitle={filter === "all" ? (world === "arabic" ? "Follow an Arabic TV show to start tracking" : "Follow TV shows to start tracking") : `This filter is empty across your full ${world === "arabic" ? "Arabic TV" : "TV Shows"} collection`}
        />
      ) : (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {items.map((s: any) => (
              <AllShowCard key={s.id} show={{ ...s, _trackingStatus: s._trackingStatus ?? deriveTrackingStatus(s) }} onGo={() => s.tmdbId && onGo(s.tmdbId)} />
            ))}
          </div>
          {totalPages > 1 && (
            <div className="flex items-center justify-center gap-2 pt-4">
              <Button variant="outline" size="sm" disabled={page === 0} onClick={() => setPage((p) => Math.max(0, p - 1))}>
                Prev
              </Button>
              <span className="text-sm text-muted-foreground px-3">
                Page <span className="font-bold text-foreground">{page + 1}</span> of {totalPages}
              </span>
              <Button variant="outline" size="sm" disabled={page >= totalPages - 1} onClick={() => setPage((p) => p + 1)}>
                Next
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
      onClick={onClick}
      className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium border transition-[color,background-color,border-color,box-shadow] ${
        active
          ? `${color} border-current/30`
          : "bg-muted/40 text-muted-foreground border-transparent hover:bg-muted hover:text-foreground"
      }`}
    >
      {icon}
      {label}
      <span className={`ml-0.5 px-1.5 py-0.5 rounded-full text-[10px] font-bold ${active ? "bg-background/40" : "bg-muted"}`}>{count}</span>
    </button>
  );
}

function AllShowCard({ show, onGo }: { show: any; onGo: () => void }) {
  const trackingStatus = show._trackingStatus as TrackingStatus;
  const userRating = trackingStatus === "finished" && show._isEndedByTmdb === true
    ? show.userRating
    : null;
  const totalEps = show._airedEpisodeCount ?? show.episodes;
  const seasons = show.seasons;

  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
      <Card className="p-3 flex gap-3 group hover:border-primary/40 hover:shadow-md hover:shadow-primary/5 transition-[border-color,box-shadow,background-color] duration-200 cursor-pointer" onClick={onGo}>
        <div className="w-14 h-20 rounded-md overflow-hidden bg-muted flex-shrink-0 relative">
          {show.poster ? (
            <SafeImage src={img(show.poster, "w92")} alt={show.title} fill variant="poster" className="transition-opacity duration-200 group-hover:opacity-95" />
          ) : (
            <div className="w-full h-full flex items-center justify-center"><Tv className="w-5 h-5 text-muted-foreground" /></div>
          )}
        </div>
        <div className="flex-1 min-w-0 flex flex-col">
          <h4 className="font-semibold text-sm line-clamp-1 group-hover:text-primary transition-colors">{show.title}</h4>
          <div className="flex items-center gap-1 mt-1 flex-wrap">
            <TrackingStatusBadge status={trackingStatus} />
            {show.isAnime && <Badge className="text-[9px] bg-purple-500/20 text-purple-400 border-0">Anime</Badge>}
            {seasons != null && seasons > 0 && <Badge variant="secondary" className="text-[10px]">{seasons} season{seasons > 1 ? "s" : ""}</Badge>}
          </div>
          <div className="flex items-center gap-3 mt-1 flex-wrap">
            {totalEps != null && <span className="text-[10px] text-muted-foreground">{totalEps} eps</span>}
            {show._watchedAiredEpisodeCount != null && <span className="text-[10px] text-muted-foreground">{show._watchedAiredEpisodeCount}/{show._airedEpisodeCount ?? "?"} released watched</span>}
            {show.year && <span className="text-[10px] text-muted-foreground">{show.year}</span>}
          </div>
          {show._hasUnwatchedReleasedEpisode && (
            <p className="text-[10px] text-orange-400 mt-1 font-medium line-clamp-1">
              Released episode waiting — continue watching
            </p>
          )}
          {show._nextEpisodeAirDate && (
            <p className="text-[10px] text-amber-400 mt-1 line-clamp-1">
              Upcoming: {show._nextEpisodeSeasonNumber ? `S${show._nextEpisodeSeasonNumber}` : ""}{show._nextEpisodeNumber ? `E${show._nextEpisodeNumber}` : ""}
              {show._nextEpisodeName ? ` · ${show._nextEpisodeName}` : ""} · {new Date(show._nextEpisodeAirDate).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
            </p>
          )}
          {!show._nextEpisodeAirDate && show._daysSinceLastWatch != null && show._daysSinceLastWatch >= 30 && trackingStatus !== "finished" && (
            <p className="text-[10px] text-orange-400 mt-1">Last watched {show._daysSinceLastWatch} days ago</p>
          )}
          {userRating != null && (
            <div className="flex items-center gap-1 mt-1">
              <Star className="w-3 h-3 text-amber-400 fill-amber-400" />
              <span className="text-[10px] text-amber-400 font-bold">{userRating}/100</span>
              <div className="flex-1 h-1 rounded-full bg-muted overflow-hidden">
                <div className="h-full bg-amber-400" style={{ width: `${userRating}%` }} />
              </div>
            </div>
          )}
        </div>
      </Card>
    </motion.div>
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
