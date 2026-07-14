"use client";

import { useStats, useShowProgress, useEpisodeToggle, useBulkEpisodeToggle, useMedia, useMediaUpdate, useRatingMutate, useTvTracking, useTvTrackingCounts, type EpisodeCompletion, type TvTrackingCategory } from "@/hooks/use-tmdb";
import { useNav } from "@/lib/store";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { RatingDialog } from "@/components/media/rating-dialog";
import { EpisodeWatchConfirmationDialog } from "@/components/media/episode-watch-confirmation-dialog";
import { SafeImage } from "@/components/media/safe-image";
import { Play, ChevronRight, Tv, Loader2, CheckCircle2, Clock, Calendar, SkipForward, ListChecks, Clapperboard, BookOpen, Sparkles, Trophy, Star, Zap, Layers } from "lucide-react";
import { img } from "@/lib/tmdb";
import { motion } from "framer-motion";
import { toast } from "sonner";
import { useState } from "react";
import {
  buildEpisodeWatchPlan,
  buildSeasonWatchPlan,
  progressEpisodesToWatchRefs,
  type EpisodeWatchPlan,
} from "@/lib/episode-watch-plan";


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
    return <Badge className="text-[11px] bg-emerald-500/20 text-emerald-400 border-0"><Trophy className="w-2.5 h-2.5 mr-1" /> Finished</Badge>;
  }
  if (status === "uptodate") {
    return <Badge className="text-[11px] bg-cyan-500/20 text-cyan-400 border-0"><Zap className="w-2.5 h-2.5 mr-1" /> Up To Date</Badge>;
  }
  if (status === "watching") {
    return <Badge className="text-[11px] bg-blue-500/20 text-blue-400 border-0"><Play className="w-2.5 h-2.5 mr-1" /> Watching</Badge>;
  }
  if (status === "planned") {
    return <Badge className="text-[11px] bg-purple-500/20 text-purple-400 border-0"><BookOpen className="w-2.5 h-2.5 mr-1" /> Planned</Badge>;
  }
  return <Badge className="text-[11px] bg-slate-500/20 text-slate-300 border-0"><Clock className="w-2.5 h-2.5 mr-1" /> Not Started</Badge>;
}

export function TvShowsView({ world = "standard", embedded = false }: { world?: "standard" | "arabic"; embedded?: boolean }) {
  const stats = useStats();
  const trackingCounts = useTvTrackingCounts(world);
  const counts = trackingCounts.data?.counts;
  const goTv = useNav((s) => s.goTv);

  // Rating dialog state — kept for completion flows that open from episode actions.
  const [ratingTarget, setRatingTarget] = useState<{
    showId: number;
    title: string;
    poster: string | null;
  } | null>(null);
  const ratingMutate = useRatingMutate();

  const handleRateSubmit = async (rating: number) => {
    if (!ratingTarget) return;
    await ratingMutate.mutateAsync({
      action: "set",
      mediaType: "tv",
      tmdbId: ratingTarget.showId,
      value: rating,
      title: ratingTarget.title,
      posterPath: ratingTarget.poster,
    });
    setRatingTarget(null);
  };

  return (
    <div className="space-y-6">
      {!embedded && (
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-xl bg-primary/15 flex items-center justify-center">
            <Clapperboard className="w-6 h-6 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight">{world === "arabic" ? "Arabic TV Shows" : "TV Shows"}</h1>
            <p className="text-sm text-muted-foreground mt-0.5">
              {world === "arabic"
                ? "Arabic-language series tracking, fully separated from TV Shows and Anime"
                : "Your complete non-anime, non-Arabic TV tracking world, with global counts across every show"}
            </p>
          </div>
        </div>
      )}

      {/* TV Shows filters, all backed by full-collection counters. */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-3">
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

      <RatingDialog
        open={!!ratingTarget}
        onOpenChange={(open) => !open && setRatingTarget(null)}
        title={ratingTarget?.title || ""}
        poster={ratingTarget?.poster ?? null}
        onRate={handleRateSubmit}
      />
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
      <div className="flex items-center justify-between gap-3 px-1 flex-wrap">
        <div className="flex items-center gap-2">
          <Layers className="w-5 h-5 text-primary" />
          <h2 className="text-lg sm:text-xl font-bold tracking-tight">{world === "arabic" ? "All Arabic TV Shows" : "All TV Shows"}</h2>
          <span className="text-xs text-muted-foreground ml-1">({total})</span>
        </div>
        <Badge variant="secondary" className="text-[10px]">
          Global counters
        </Badge>
      </div>
      <p className="text-xs text-muted-foreground px-1 -mt-2">
        Use these filters from inside All. {world === "arabic"
          ? "Every number is calculated across your complete Arabic TV collection only, never from standard TV Shows, Anime or the visible page."
          : "Every number is calculated across your complete TV Shows collection, never from Arabic TV, Anime or only the visible page."}
      </p>

      <div className="flex items-center gap-2 flex-wrap px-1">
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

      {tracking.isLoading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
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
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
            {items.map((s: any) => (
              <AllShowCard key={s.id} show={{ ...s, _trackingStatus: s._trackingStatus ?? deriveTrackingStatus(s) }} onGo={() => s.tmdbId && onGo(s.tmdbId)} world={world} />
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
      className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium border transition-all ${
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

function AllShowCard({ show, onGo, world }: { show: any; onGo: () => void; world: "standard" | "arabic" }) {
  const update = useMediaUpdate();
  const trackingStatus = show._trackingStatus as TrackingStatus;
  const userRating = trackingStatus === "finished" && show._isEndedByTmdb === true
    ? show.userRating
    : null;
  const totalEps = show._airedEpisodeCount ?? show.episodes;
  const seasons = show.seasons;

  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
      <Card className="p-3 flex gap-3 group hover:border-primary/40 hover:shadow-lg hover:shadow-primary/5 transition-all cursor-pointer" onClick={onGo}>
        <div className="w-20 h-28 rounded-md overflow-hidden bg-muted flex-shrink-0 relative">
          {show.poster ? (
            <SafeImage src={img(show.poster, "w92")} alt={show.title} fill variant="poster" className="group-hover:scale-105 transition-transform" />
          ) : (
            <div className="w-full h-full flex items-center justify-center"><Tv className="w-5 h-5 text-muted-foreground" /></div>
          )}
        </div>
        <div className="flex-1 min-w-0 flex flex-col">
          <h4 className="font-semibold text-sm line-clamp-1 group-hover:text-primary transition-colors">{show.title}</h4>
          <div className="flex items-center gap-1 mt-1 flex-wrap">
            <TrackingStatusBadge status={trackingStatus} />
            {show.isAnime && <Badge className="text-[11px] bg-purple-500/20 text-purple-400 border-0">Anime</Badge>}
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
          <div className="mt-2 flex flex-wrap gap-1.5">
            {world === "standard" ? (
              <>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-9 text-[11px]"
                  onClick={(event) => {
                    event.stopPropagation();
                    void update.mutateAsync({ id: show.id, isAnime: true, isArabic: false }).then(() => toast.success("Moved to Anime"));
                  }}
                >
                  <Sparkles className="w-3 h-3 mr-1" /> To Anime
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-9 text-[11px]"
                  onClick={(event) => {
                    event.stopPropagation();
                    void update.mutateAsync({ id: show.id, isArabic: true, isAnime: false }).then(() => toast.success("Moved to Arabic TV"));
                  }}
                >
                  <span className="mr-1 font-black">ع</span> To Arabic TV
                </Button>
              </>
            ) : (
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-9 text-[11px]"
                onClick={(event) => {
                  event.stopPropagation();
                  void update.mutateAsync({ id: show.id, isArabic: false, isAnime: false }).then(() => toast.success("Moved to TV Shows"));
                }}
              >
                <Clapperboard className="w-3 h-3 mr-1" /> To TV Shows
              </Button>
            )}
          </div>
        </div>
      </Card>
    </motion.div>
  );
}

function UpToDateShowCard({ show, onGo }: { show: any; onGo: () => void }) {
  const userRating = null;
  const totalEps = show.episodes;

  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
      <Card className="p-3 flex gap-3 group hover:border-primary/40 hover:shadow-lg hover:shadow-primary/5 transition-all cursor-pointer" onClick={onGo}>
        <div className="w-20 h-28 rounded-md overflow-hidden bg-muted flex-shrink-0 relative">
          {show.poster ? (
            <SafeImage src={img(show.poster, "w92")} alt={show.title} fill variant="poster" className="group-hover:scale-105 transition-transform" />
          ) : (
            <div className="w-full h-full flex items-center justify-center"><Tv className="w-5 h-5 text-muted-foreground" /></div>
          )}
          <div className="absolute inset-0 bg-cyan-500/20 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
            <Zap className="w-7 h-7 text-cyan-400" />
          </div>
        </div>
        <div className="flex-1 min-w-0 flex flex-col">
          <h4 className="font-semibold text-sm line-clamp-1 group-hover:text-primary transition-colors">{show.title}</h4>
          <div className="flex items-center gap-1 mt-1 flex-wrap">
            <Badge className="text-[11px] bg-cyan-500/20 text-cyan-400 border-0">
              <Zap className="w-2.5 h-2.5 mr-1" /> Up To Date
            </Badge>
            {show.isAnime && <Badge className="text-[11px] bg-purple-500/20 text-purple-400 border-0">Anime</Badge>}
            {show.seasons && <Badge variant="secondary" className="text-[10px]">{show.seasons} season{show.seasons > 1 ? "s" : ""}</Badge>}
            <Badge className="text-[11px] bg-emerald-500/20 text-emerald-400 border-0">Returning</Badge>
          </div>
          <div className="flex items-center gap-3 mt-1">
            {totalEps && <span className="text-[10px] text-muted-foreground">{totalEps} episodes watched</span>}
            {show.year && <span className="text-[10px] text-muted-foreground">{show.year}</span>}
          </div>
          {userRating != null ? (
            <div className="flex items-center gap-1 mt-1">
              <Star className="w-3 h-3 text-amber-400 fill-amber-400" />
              <span className="text-[10px] text-amber-400 font-bold">{userRating}/100</span>
              <div className="flex-1 h-1 rounded-full bg-muted overflow-hidden">
                <div className="h-full bg-amber-400" style={{ width: `${userRating}%` }} />
              </div>
            </div>
          ) : (
            <p className="text-[10px] text-muted-foreground/70 mt-1 italic">Waiting for show to end — rate it then</p>
          )}
        </div>
      </Card>
    </motion.div>
  );
}

function FinishedShowCard({ show, onGo }: { show: any; onGo: () => void }) {
  const status = show.status;
  // For finished shows, we always show "Ended" badge
  const statusBadge = <Badge className="text-[11px] bg-rose-500/20 text-rose-400 border-0">Ended</Badge>;
  const userRating = show.userRating;
  const totalEps = show.episodes;

  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
      <Card className="p-3 flex gap-3 group hover:border-primary/40 hover:shadow-lg hover:shadow-primary/5 transition-all cursor-pointer" onClick={onGo}>
        <div className="w-20 h-28 rounded-md overflow-hidden bg-muted flex-shrink-0 relative">
          {show.poster ? (
            <SafeImage src={img(show.poster, "w92")} alt={show.title} fill variant="poster" className="group-hover:scale-105 transition-transform" />
          ) : (
            <div className="w-full h-full flex items-center justify-center"><Tv className="w-5 h-5 text-muted-foreground" /></div>
          )}
          <div className="absolute inset-0 bg-emerald-500/20 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
            <CheckCircle2 className="w-7 h-7 text-emerald-400" />
          </div>
        </div>
        <div className="flex-1 min-w-0 flex flex-col">
          <h4 className="font-semibold text-sm line-clamp-1 group-hover:text-primary transition-colors">{show.title}</h4>
          <div className="flex items-center gap-1 mt-1 flex-wrap">
            <Badge className="text-[11px] bg-emerald-500/20 text-emerald-400 border-0">
              <CheckCircle2 className="w-2.5 h-2.5 mr-1" /> Finished
            </Badge>
            {show.isAnime && <Badge className="text-[11px] bg-purple-500/20 text-purple-400 border-0">Anime</Badge>}
            {show.seasons && <Badge variant="secondary" className="text-[10px]">{show.seasons} season{show.seasons > 1 ? "s" : ""}</Badge>}
            {statusBadge}
          </div>
          <div className="flex items-center gap-3 mt-1">
            {totalEps && <span className="text-[10px] text-muted-foreground">{totalEps} episodes</span>}
            {show.year && <span className="text-[10px] text-muted-foreground">{show.year}</span>}
          </div>
          {userRating != null ? (
            <div className="flex items-center gap-1 mt-1">
              <Star className="w-3 h-3 text-amber-400 fill-amber-400" />
              <span className="text-[10px] text-amber-400 font-bold">{userRating}/100</span>
              <div className="flex-1 h-1 rounded-full bg-muted overflow-hidden">
                <div className="h-full bg-amber-400" style={{ width: `${userRating}%` }} />
              </div>
            </div>
          ) : (
            <div className="flex items-center gap-1 mt-1">
              <Button
                size="sm"
                variant="outline"
                className="h-9 text-[11px] px-2"
                onClick={(e) => { e.stopPropagation(); onGo(); }}
              >
                <Star className="w-2.5 h-2.5 mr-1" /> Rate this show
              </Button>
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

/** Fetches show data and returns categorized info for tab filtering */
function useShowTrackingData(showId: number) {
  return useShowProgress(showId);
}

// ============ NEXT EPISODE CARD (with Make Previous Episodes dialog) ============

function NextEpisodeCard({ showId, title, poster, onGo, featured, onCompletion }: {
  showId: number;
  title: string;
  poster: string | null;
  onGo: () => void;
  featured?: boolean;
  onCompletion?: (c: EpisodeCompletion | null | undefined) => void;
}) {
  const data = useShowTrackingData(showId);
  const episodeToggle = useEpisodeToggle();
  const bulkToggle = useBulkEpisodeToggle();

  const [watchPlan, setWatchPlan] = useState<EpisodeWatchPlan | null>(null);

  const { nextEp, totalEpisodes, watchedCount, watchedSet, seasons, allEpisodes, isLoading } = data;
  const progress = totalEpisodes > 0 ? Math.round((watchedCount / totalEpisodes) * 100) : 0;
  const remaining = Math.max(0, totalEpisodes - watchedCount);

  const releasedTimeline = progressEpisodesToWatchRefs(allEpisodes);

  const applyWatchPlan = async (plan: EpisodeWatchPlan, includePrevious: boolean) => {
    const episodes = includePrevious ? plan.allEpisodes : plan.selectedEpisodes;
    if (episodes.length === 0) {
      setWatchPlan(null);
      return;
    }
    try {
      const result = episodes.length === 1
        ? await episodeToggle.mutateAsync({
            action: "add",
            showId,
            seasonNumber: episodes[0].seasonNumber,
            episodeNumber: episodes[0].episodeNumber,
            episodeName: episodes[0].episodeName || undefined,
          })
        : await bulkToggle.mutateAsync({ showId, episodes });
      const previousCount = includePrevious ? plan.previousUnwatched.length : 0;
      toast.success(
        previousCount > 0
          ? `Marked ${episodes.length} released episodes as watched, including earlier gaps.`
          : plan.kind === "episode"
            ? `${plan.targetLabel} marked as watched.`
            : `${plan.targetLabel} marked as watched.`,
      );
      onCompletion?.(result?.completion);
      setWatchPlan(null);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to mark episodes");
    }
  };

  const markWatched = async () => {
    if (!nextEp) return;
    const plan = buildEpisodeWatchPlan({
      target: {
        seasonNumber: nextEp.seasonNumber,
        episodeNumber: nextEp.episode.episode_number,
        episodeName: nextEp.episode.name,
      },
      releasedEpisodes: releasedTimeline,
      watchedKeys: watchedSet,
    });
    if (plan.previousUnwatched.length > 0) {
      setWatchPlan(plan);
      return;
    }
    await applyWatchPlan(plan, false);
  };

  const markAllSeason = async () => {
    if (!nextEp) return;
    const plan = buildSeasonWatchPlan({
      seasonNumber: nextEp.seasonNumber,
      releasedEpisodes: releasedTimeline,
      watchedKeys: watchedSet,
    });
    if (plan.selectedEpisodes.length === 0) {
      toast.info("All released episodes in this season are already watched");
      return;
    }
    if (plan.previousUnwatched.length > 0) {
      setWatchPlan(plan);
      return;
    }
    await applyWatchPlan(plan, false);
  };

  if (isLoading) {
    return (
      <Card className="p-3 h-[200px] flex items-center gap-3">
        <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
        <span className="text-sm text-muted-foreground">Loading {title}...</span>
      </Card>
    );
  }

  const allWatched = totalEpisodes > 0 && !nextEp;

  if (allWatched) {
    return (
      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
        <Card className="overflow-hidden p-0 border-emerald-500/30 bg-emerald-500/5 hover:border-emerald-500/50 transition-all group">
          <div className="flex">
            <button onClick={onGo} className="relative w-28 h-28 flex-shrink-0 overflow-hidden bg-muted">
              {poster ? <SafeImage src={img(poster, "w185")} alt={title} fill variant="poster" /> : <div className="w-full h-full flex items-center justify-center"><Tv className="w-6 h-6 text-muted-foreground" /></div>}
              <div className="absolute inset-0 bg-emerald-500/20 flex items-center justify-center">
                <CheckCircle2 className="w-8 h-8 text-emerald-400" />
              </div>
            </button>
            <div className="flex-1 p-3 flex flex-col">
              <p className="text-[10px] text-emerald-400 font-bold uppercase tracking-wide">All caught up!</p>
              <p className="text-sm font-semibold line-clamp-1 mt-0.5">{title}</p>
              <div className="flex items-center gap-2 mt-1">
                <Badge variant="secondary" className="text-[11px] bg-emerald-500/15 text-emerald-400">{watchedCount}/{totalEpisodes} eps</Badge>
                <Badge variant="secondary" className="text-[11px]">100%</Badge>
              </div>
              <Button size="sm" variant="outline" className="h-9 text-xs mt-auto w-fit" onClick={onGo}>
                View details <ChevronRight className="w-3 h-3 ml-1" />
              </Button>
            </div>
          </div>
        </Card>
      </motion.div>
    );
  }

  if (!nextEp) {
    return (
      <Card className="p-3 h-[140px] flex items-center gap-3">
        <button onClick={onGo} className="relative w-20 h-28 rounded-md overflow-hidden bg-muted flex-shrink-0">
          {poster ? <SafeImage src={img(poster, "w92")} alt={title} fill variant="poster" /> : <div className="w-full h-full flex items-center justify-center"><Tv className="w-5 h-5 text-muted-foreground" /></div>}
        </button>
        <div>
          <p className="text-sm font-semibold line-clamp-1">{title}</p>
          <p className="text-xs text-muted-foreground mt-1">Tap to explore seasons</p>
        </div>
      </Card>
    );
  }

  const ep = nextEp.episode;
  const epRuntime = ep.runtime ? `${ep.runtime}m` : null;
  const epAirDate = ep.air_date ? new Date(ep.air_date).toLocaleDateString("en-US", { month: "short", day: "numeric" }) : null;

  return (
    <>
      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
        <Card className={`overflow-hidden p-0 hover:border-primary/50 transition-all group ${featured ? "ring-2 ring-primary/30 shadow-lg shadow-primary/10" : ""}`}>
          <div className="flex">
            <button onClick={onGo} className="relative w-28 h-28 flex-shrink-0 overflow-hidden bg-muted">
              {ep.still_path ? (
                <SafeImage src={img(ep.still_path, "w300")} alt={ep.name} fill variant="still" className="group-hover:scale-105 transition-transform" />
              ) : poster ? (
                <SafeImage src={img(poster, "w185")} alt={title} fill variant="poster" />
              ) : (
                <div className="w-full h-full flex items-center justify-center"><Tv className="w-6 h-6 text-muted-foreground" /></div>
              )}
              <span className="absolute top-1 left-1 bg-background/90 backdrop-blur text-[10px] font-bold px-1.5 py-0.5 rounded">
                S{nextEp.seasonNumber}E{ep.episode_number}
              </span>
              {featured && (
                <span className="absolute bottom-1 right-1 bg-primary text-primary-foreground text-[11px] font-bold px-1.5 py-0.5 rounded uppercase tracking-wide">
                  Watch Next
                </span>
              )}
            </button>
            <div className="flex-1 p-2.5 flex flex-col min-w-0">
              <p className="text-[10px] text-primary font-bold uppercase tracking-wide line-clamp-1">{title}</p>
              <p className="text-sm font-semibold line-clamp-1 mt-0.5">{ep.name || `Episode ${ep.episode_number}`}</p>
              <div className="flex items-center gap-2 mt-0.5">
                {epAirDate && <span className="text-[10px] text-muted-foreground flex items-center gap-0.5"><Calendar className="w-2.5 h-2.5" /> {epAirDate}</span>}
                {epRuntime && <span className="text-[10px] text-muted-foreground flex items-center gap-0.5"><Clock className="w-2.5 h-2.5" /> {epRuntime}</span>}
              </div>
              {totalEpisodes > 0 && (
                <div className="mt-1.5">
                  <div className="flex items-center justify-between text-[10px] text-muted-foreground mb-0.5">
                    <span>{watchedCount} watched</span>
                    <span className="font-bold text-primary">{progress}%</span>
                  </div>
                  <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                    <div className="h-full bg-gradient-to-r from-primary to-purple-500 transition-all duration-500" style={{ width: `${progress}%` }} />
                  </div>
                  <div className="text-[10px] text-muted-foreground mt-0.5">{remaining} remaining of {totalEpisodes}</div>
                </div>
              )}
            </div>
          </div>
          <div className="flex items-center gap-1.5 p-2.5 pt-2 border-t border-border/40">
            <Button size="sm" className="h-9 text-xs flex-1" onClick={markWatched} disabled={episodeToggle.isPending || bulkToggle.isPending}>
              <Play className="w-3 h-3 mr-1 fill-current" /> Mark watched
            </Button>
            <Button size="sm" variant="outline" className="h-9 text-xs" onClick={markAllSeason} title="Mark rest of season watched">
              <SkipForward className="w-3 h-3 mr-1" /> Season
            </Button>
            <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={onGo} aria-label="Open show">
              <ChevronRight className="w-4 h-4" />
            </Button>
          </div>
        </Card>
      </motion.div>

      <EpisodeWatchConfirmationDialog
        plan={watchPlan}
        open={Boolean(watchPlan)}
        pending={episodeToggle.isPending || bulkToggle.isPending}
        onOpenChange={(nextOpen) => { if (!nextOpen) setWatchPlan(null); }}
        onSelectedOnly={() => watchPlan ? applyWatchPlan(watchPlan, false) : undefined}
        onWithPrevious={() => watchPlan ? applyWatchPlan(watchPlan, true) : undefined}
      />
    </>
  );
}

// ============ SHOW PROGRESS CARD ============

function ShowProgressCard({ showId, title, poster, onGo }: { showId: number; title: string; poster: string | null; onGo: () => void }) {
  const progress = useShowProgress(showId);

  const totalEpisodes = progress.totalEpisodes ?? 0;
  const watchedCount = progress.watchedCount ?? 0;
  const progressPct = totalEpisodes > 0 ? Math.round((watchedCount / totalEpisodes) * 100) : 0;
  const remaining = Math.max(0, totalEpisodes - watchedCount);
  const seasons = progress.showDetail?.number_of_seasons;
  const status = progress.showDetail?.status;
  const isLoading = progress.isLoading;

  // Status badge logic
  const statusBadge = getStatusBadge(status);

  // Not Started badge if 0 watched
  const notStarted = watchedCount === 0 && !isLoading;
  const watchBadge = notStarted
    ? <Badge className="text-[11px] bg-purple-500/20 text-purple-400 border-0">Not Started</Badge>
    : null;

  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
      <Card className="p-3 flex gap-3 group hover:border-primary/40 hover:shadow-lg hover:shadow-primary/5 transition-all cursor-pointer" onClick={onGo}>
        <div className="relative w-20 h-28 rounded-md overflow-hidden bg-muted flex-shrink-0">
          {poster ? (
            <SafeImage src={img(poster, "w92")} alt={title} fill variant="poster" className="group-hover:scale-105 transition-transform" />
          ) : (
            <div className="w-full h-full flex items-center justify-center"><Tv className="w-5 h-5 text-muted-foreground" /></div>
          )}
        </div>
        <div className="flex-1 min-w-0 flex flex-col">
          <h4 className="font-semibold text-sm line-clamp-1 group-hover:text-primary transition-colors">{title}</h4>
          <div className="flex items-center gap-1 mt-1 flex-wrap">
            {seasons != null && seasons > 0 && <Badge variant="secondary" className="text-[10px]">{seasons} season{seasons > 1 ? "s" : ""}</Badge>}
            {statusBadge}
            {watchBadge}
          </div>
          {isLoading ? (
            <div className="mt-2">
              <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                <div className="h-full shimmer w-1/3" />
              </div>
            </div>
          ) : totalEpisodes > 0 ? (
            <div className="mt-2">
              <div className="flex items-center justify-between text-[10px] text-muted-foreground mb-0.5">
                <span>{watchedCount} / {totalEpisodes} eps</span>
                <span className="font-bold text-primary">{progressPct}%</span>
              </div>
              <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                <div className="h-full bg-gradient-to-r from-primary to-purple-500 transition-all duration-500" style={{ width: `${progressPct}%` }} />
              </div>
              <p className="text-[10px] text-muted-foreground mt-0.5">{remaining} remaining</p>
            </div>
          ) : (
            <p className="text-[10px] text-muted-foreground mt-2">No episode data</p>
          )}
        </div>
      </Card>
    </motion.div>
  );
}

// ============ UPCOMING LIST ============

function UpcomingList({ shows, onGo }: { shows: any[]; onGo: (id: number) => void }) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
      {shows.map((s) => (
        <UpcomingCard key={s.id} showId={s.tmdbId} title={s.title} poster={s.poster} onGo={() => onGo(s.tmdbId)} />
      ))}
    </div>
  );
}

function UpcomingCard({ showId, title, poster, onGo }: { showId: number; title: string; poster: string | null; onGo: () => void }) {
  const data = useShowTrackingData(showId);
  const { nextUpcomingEpisode, isLoading, showDetail } = data;

  if (isLoading) {
    return <Card className="p-3 h-[100px] flex items-center gap-3"><Loader2 className="w-4 h-4 animate-spin text-muted-foreground" /><span className="text-xs text-muted-foreground">Loading...</span></Card>;
  }

  const now = new Date();
  const upcomingAirDate = nextUpcomingEpisode?.episode?.air_date
    ? new Date(`${nextUpcomingEpisode.episode.air_date}T00:00:00`)
    : null;
  if (!nextUpcomingEpisode || !upcomingAirDate || upcomingAirDate <= now) return null;

  const daysUntil = Math.ceil((upcomingAirDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
  const ep = nextUpcomingEpisode.episode;
  const status = showDetail?.status;
  const statusBadge = getStatusBadge(status);

  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
      <Card className="p-3 flex gap-3 group hover:border-primary/40 hover:shadow-lg hover:shadow-primary/5 transition-all cursor-pointer" onClick={onGo}>
        <div className="relative w-20 h-28 rounded-md overflow-hidden bg-muted flex-shrink-0">
          {poster ? <SafeImage src={img(poster, "w92")} alt={title} fill variant="poster" /> : <div className="w-full h-full flex items-center justify-center"><Tv className="w-5 h-5 text-muted-foreground" /></div>}
        </div>
        <div className="flex-1 min-w-0 flex flex-col">
          <h4 className="font-semibold text-sm line-clamp-1 group-hover:text-primary transition-colors">{title}</h4>
          <div className="flex items-center gap-1 mt-1 flex-wrap">
            <Badge className="text-[11px] bg-amber-500/20 text-amber-400 border-0">
              <Calendar className="w-2.5 h-2.5 mr-1" /> In {daysUntil} day{daysUntil !== 1 ? "s" : ""}
            </Badge>
            {statusBadge}
          </div>
          <p className="text-[10px] text-muted-foreground mt-1 line-clamp-1">
            S{nextUpcomingEpisode.seasonNumber}E{ep.episode_number}: {ep.name || `Episode ${ep.episode_number}`}
          </p>
          <p className="text-[10px] text-muted-foreground">
            {upcomingAirDate.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
          </p>
        </div>
      </Card>
    </motion.div>
  );
}

// Helper: get status badge
function getStatusBadge(status?: string | null): React.ReactNode {
  if (!status) return null;
  const s = status.toLowerCase();
  if (s.includes("ended") || s.includes("canceled")) {
    return <Badge className="text-[11px] bg-rose-500/20 text-rose-400 border-0">Ended</Badge>;
  }
  if (s.includes("returning") || s.includes("continuous") || s.includes("production")) {
    return <Badge className="text-[11px] bg-emerald-500/20 text-emerald-400 border-0">Returning</Badge>;
  }
  return <Badge variant="secondary" className="text-[11px]">{status}</Badge>;
}

// ============ HAVEN'T WATCHED / HAVEN'T STARTED LIST ============

function HaventWatchedList({ shows, onGo, type }: { shows: any[]; onGo: (id: number) => void; type: "while" | "started" }) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
      {shows.map((s) => (
        <HaventWatchedCard key={s.id} showId={s.tmdbId} title={s.title} poster={s.poster} onGo={() => onGo(s.tmdbId)} type={type} />
      ))}
    </div>
  );
}

function HaventWatchedCard({ showId, title, poster, onGo, type }: { showId: number; title: string; poster: string | null; onGo: () => void; type: "while" | "started" }) {
  const data = useShowTrackingData(showId);
  const { watchedCount, daysSinceLastWatch, isLoading, totalEpisodes, lastWatchedDate, showDetail } = data;

  if (isLoading) {
    return <Card className="p-3 h-[100px] flex items-center gap-3"><Loader2 className="w-4 h-4 animate-spin text-muted-foreground" /><span className="text-xs text-muted-foreground">Loading...</span></Card>;
  }

  // Haven't Started: 0 watched episodes
  if (type === "started" && watchedCount > 0) return null;

  // Haven't Watched For A While: started but 30+ days since last watch
  if (type === "while") {
    if (watchedCount === 0) return null; // hasn't started
    if (daysSinceLastWatch === null || daysSinceLastWatch < 30) return null; // watched recently
  }

  const statusBadge = getStatusBadge(showDetail?.status);

  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
      <Card className="p-3 flex gap-3 group hover:border-primary/40 hover:shadow-lg hover:shadow-primary/5 transition-all cursor-pointer" onClick={onGo}>
        <div className="relative w-20 h-28 rounded-md overflow-hidden bg-muted flex-shrink-0">
          {poster ? <SafeImage src={img(poster, "w92")} alt={title} fill variant="poster" /> : <div className="w-full h-full flex items-center justify-center"><Tv className="w-5 h-5 text-muted-foreground" /></div>}
        </div>
        <div className="flex-1 min-w-0 flex flex-col">
          <h4 className="font-semibold text-sm line-clamp-1 group-hover:text-primary transition-colors">{title}</h4>
          <div className="flex items-center gap-1 mt-1 flex-wrap">
            {type === "started" ? (
              <Badge className="text-[11px] bg-purple-500/20 text-purple-400 border-0">
                <Sparkles className="w-2.5 h-2.5 mr-1" /> Not started
              </Badge>
            ) : (
              <Badge className="text-[11px] bg-amber-500/20 text-amber-400 border-0">
                <Clock className="w-2.5 h-2.5 mr-1" /> {daysSinceLastWatch} days ago
              </Badge>
            )}
            {statusBadge}
          </div>
          {type === "started" ? (
            <p className="text-[10px] text-muted-foreground mt-1">{totalEpisodes > 0 ? `${totalEpisodes} episodes available` : "Tap to explore"}</p>
          ) : (
            <>
              <p className="text-[10px] text-muted-foreground mt-1">{watchedCount} / {totalEpisodes} eps watched</p>
              {lastWatchedDate && (
                <p className="text-[10px] text-muted-foreground">Last: {lastWatchedDate.toLocaleDateString()}</p>
              )}
            </>
          )}
        </div>
      </Card>
    </motion.div>
  );
}
