"use client";

import { useStats, useShowProgress, useEpisodeToggle, useBulkEpisodeToggle, useMedia, useRatingMutate, useTvTracking, useTvTrackingCounts, type EpisodeCompletion, type TvTrackingCategory } from "@/hooks/use-tmdb";
import { useNav } from "@/lib/store";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { RatingDialog } from "@/components/media/rating-dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Play, ChevronRight, Tv, Loader2, CheckCircle2, Clock, Calendar, SkipForward, ListChecks, Clapperboard, BookOpen, AlertCircle, Sparkles, Trophy, Star, Zap, Layers } from "lucide-react";
import { img } from "@/lib/tmdb";
import { motion } from "framer-motion";
import { toast } from "sonner";
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
    return <Badge className="text-[9px] bg-emerald-500/20 text-emerald-400 border-0"><Trophy className="w-2.5 h-2.5 mr-1" /> Finished</Badge>;
  }
  if (status === "uptodate") {
    return <Badge className="text-[9px] bg-cyan-500/20 text-cyan-400 border-0"><Zap className="w-2.5 h-2.5 mr-1" /> Up To Date</Badge>;
  }
  if (status === "watching") {
    return <Badge className="text-[9px] bg-blue-500/20 text-blue-400 border-0"><Play className="w-2.5 h-2.5 mr-1" /> Watching</Badge>;
  }
  if (status === "planned") {
    return <Badge className="text-[9px] bg-purple-500/20 text-purple-400 border-0"><BookOpen className="w-2.5 h-2.5 mr-1" /> Planned</Badge>;
  }
  return <Badge className="text-[9px] bg-slate-500/20 text-slate-300 border-0"><Clock className="w-2.5 h-2.5 mr-1" /> Not Started</Badge>;
}

export function TvTrackingView() {
  const stats = useStats();
  const trackingCounts = useTvTrackingCounts();
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
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="w-12 h-12 rounded-xl bg-primary/15 flex items-center justify-center">
          <Clapperboard className="w-6 h-6 text-primary" />
        </div>
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight">TV Tracking</h1>
          <p className="text-sm text-muted-foreground mt-0.5">All TV filters now live inside All, with global counts across your full library</p>
        </div>
      </div>

      {/* Global Stats row — never page-scoped */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        <StatCard icon={<Layers className="w-5 h-5" />} label="All Shows" value={counts?.all ?? "…"} color="from-purple-500/20 to-purple-500/5" />
        <StatCard icon={<BookOpen className="w-5 h-5" />} label="Planned" value={counts?.planned ?? counts?.watchlist ?? "…"} color="from-violet-500/20 to-violet-500/5" />
        <StatCard icon={<Clock className="w-5 h-5" />} label="Not Started" value={counts?.notStarted ?? counts?.haventStarted ?? "…"} color="from-slate-500/20 to-slate-500/5" />
        <StatCard icon={<Play className="w-5 h-5" />} label="Watching" value={counts?.watching ?? "…"} color="from-blue-500/20 to-blue-500/5" />
        <StatCard icon={<Zap className="w-5 h-5" />} label="Up To Date" value={counts?.uptodate ?? "…"} color="from-cyan-500/20 to-cyan-500/5" />
        <StatCard icon={<Trophy className="w-5 h-5" />} label="Finished" value={counts ? counts.finished + counts.finishedAnime : "…"} color="from-emerald-500/20 to-emerald-500/5" />
      </div>

      {stats.data?.watchTime && (
        <p className="text-xs text-muted-foreground px-1 -mt-2">
          Total watch time: <strong>{stats.data.watchTime.totalHours || 0}h</strong>. Filter counters below are full-library counters, not current-page counters.
        </p>
      )}

      <AllShowsTab onGo={goTv} globalCounts={counts} />

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
function AllShowsTab({ onGo, globalCounts }: { onGo: (id: number) => void; globalCounts?: any }) {
  const [page, setPage] = useState(0);
  const [filter, setFilter] = useState<TvTrackingCategory>("all");
  const limit = 60;
  const tracking = useTvTracking({ category: filter, sortBy: "title", order: "asc", limit, offset: page * limit });

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
    finishedAnime: 0,
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
    { value: "planned", label: "Planned", count: counts.planned ?? counts.watchlist, icon: <BookOpen className="w-3 h-3" />, color: "bg-purple-500/15 text-purple-400" },
    { value: "not-started", label: "Not Started", count: counts.notStarted ?? counts.haventStarted, icon: <Clock className="w-3 h-3" />, color: "bg-slate-500/15 text-slate-300" },
    { value: "watching", label: "Watching", count: counts.watching, icon: <Play className="w-3 h-3" />, color: "bg-blue-500/15 text-blue-400" },
    { value: "uptodate", label: "Up To Date", count: counts.uptodate, icon: <Zap className="w-3 h-3" />, color: "bg-cyan-500/15 text-cyan-400" },
    { value: "finished", label: "Finished", count: counts.finished, icon: <Trophy className="w-3 h-3" />, color: "bg-emerald-500/15 text-emerald-400" },
    { value: "finished-anime", label: "Finished Anime", count: counts.finishedAnime, icon: <Sparkles className="w-3 h-3" />, color: "bg-fuchsia-500/15 text-fuchsia-400" },
    { value: "upcoming", label: "Upcoming", count: counts.upcoming, icon: <Calendar className="w-3 h-3" />, color: "bg-amber-500/15 text-amber-400" },
    { value: "havent-watched-while", label: "Haven't Watched", count: counts.haventWatched, icon: <Clock className="w-3 h-3" />, color: "bg-orange-500/15 text-orange-400" },
  ];

  const activeFilterLabel = filters.find((f) => f.value === filter)?.label ?? "All";

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3 px-1 flex-wrap">
        <div className="flex items-center gap-2">
          <Layers className="w-5 h-5 text-primary" />
          <h2 className="text-lg sm:text-xl font-bold tracking-tight">All TV Tracking</h2>
          <span className="text-xs text-muted-foreground ml-1">({total})</span>
        </div>
        <Badge variant="secondary" className="text-[10px]">
          Global counters
        </Badge>
      </div>
      <p className="text-xs text-muted-foreground px-1 -mt-2">
        Use these filters from inside All. Every number is calculated across your complete TV library, not just the visible page.
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
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {Array.from({ length: 12 }).map((_, i) => (
            <div key={i} className="h-[110px] shimmer rounded-lg" />
          ))}
        </div>
      ) : items.length === 0 ? (
        <EmptyTab
          icon={<Layers className="w-10 h-10" />}
          title={filter === "all" ? "No tracked shows yet" : `No ${activeFilterLabel} shows`}
          subtitle={filter === "all" ? "Follow TV shows to start tracking" : "This filter is empty across your full library"}
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

function AllShowCard({ show, onGo }: { show: any; onGo: () => void }) {
  const trackingStatus = show._trackingStatus as TrackingStatus;
  const userRating = trackingStatus === "finished" && show._isEndedByTmdb === true
    ? show.userRating
    : null;
  const totalEps = show._airedEpisodeCount ?? show.episodes;
  const seasons = show.seasons;

  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
      <Card className="p-3 flex gap-3 group hover:border-primary/40 hover:shadow-lg hover:shadow-primary/5 transition-all cursor-pointer" onClick={onGo}>
        <div className="w-14 h-20 rounded-md overflow-hidden bg-muted flex-shrink-0 relative">
          {show.poster ? (
            <img src={img(show.poster, "w92")} alt={show.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform" loading="lazy" />
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

function WatchlistTab({ shows, onGo, onCompletion }: { shows: any[]; onGo: (id: number) => void; onCompletion: (c: EpisodeCompletion | null | undefined, title?: string, poster?: string | null) => void }) {
  return (
    <div className="space-y-4">
      {shows.length === 0 ? (
        <EmptyTab icon={<BookOpen className="w-10 h-10" />} title="No shows in watchlist" subtitle="Follow shows to start tracking" />
      ) : (
        <>
          {/* Continue Watching - Next Episodes grid */}
          <section>
            <div className="flex items-center gap-2 mb-3 px-1">
              <Play className="w-5 h-5 text-primary fill-primary" />
              <h2 className="text-lg sm:text-xl font-bold tracking-tight">Continue Watching</h2>
              <span className="text-xs text-muted-foreground ml-1">Next episodes</span>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {shows.slice(0, 10).map((s, i) => (
                <NextEpisodeCard
                  key={s.id}
                  showId={s.tmdbId}
                  title={s.title}
                  poster={s.poster}
                  onGo={() => onGo(s.tmdbId)}
                  featured={i === 0}
                  onCompletion={(c) => onCompletion(c, s.title, s.poster)}
                />
              ))}
            </div>
          </section>

          {/* All shows with progress */}
          <section>
            <div className="flex items-center gap-2 mb-3 px-1">
              <ListChecks className="w-5 h-5 text-primary" />
              <h2 className="text-lg sm:text-xl font-bold tracking-tight">Your Shows</h2>
              <span className="text-xs text-muted-foreground ml-1">({shows.length})</span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {shows.slice(0, 30).map((s) => (
                <ShowProgressCard key={s.id} showId={s.tmdbId} title={s.title} poster={s.poster} onGo={() => onGo(s.tmdbId)} />
              ))}
            </div>
          </section>
        </>
      )}
    </div>
  );
}

function FinishedTab({ onGo, isAnime = "false", onCompletion }: { onGo: (id: number) => void; isAnime?: string; onCompletion?: (c: EpisodeCompletion | null | undefined, title?: string, poster?: string | null) => void }) {
  const [page, setPage] = useState(0);
  const limit = 60;
  // Filter by status=finished (also matches legacy "watched" via API backward-compat)
  const finished = useMedia({ type: "series", status: "finished", isAnime, sortBy: "title", order: "asc", limit, offset: page * limit });

  const items = finished.data?.items ?? [];
  const total = finished.data?.total ?? 0;
  const totalPages = Math.ceil(total / limit);

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 px-1">
        {isAnime === "true" ? (
          <Sparkles className="w-5 h-5 text-purple-400" />
        ) : (
          <Trophy className="w-5 h-5 text-amber-400" />
        )}
        <h2 className="text-lg sm:text-xl font-bold tracking-tight">
          {isAnime === "true" ? "Finished Anime" : "Finished Shows"}
        </h2>
        <span className="text-xs text-muted-foreground ml-1">({total})</span>
      </div>
      <p className="text-xs text-muted-foreground px-1 -mt-2">
        Shows that have <strong>ended</strong> and you've watched all episodes. Each is rated out of 100.
      </p>

      {finished.isLoading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {Array.from({ length: 12 }).map((_, i) => (
            <div key={i} className="h-[100px] shimmer rounded-lg" />
          ))}
        </div>
      ) : items.length === 0 ? (
        <EmptyTab icon={isAnime === "true" ? <Sparkles className="w-10 h-10" /> : <Trophy className="w-10 h-10" />} title={isAnime === "true" ? "No finished anime yet" : "No finished shows yet"} subtitle={isAnime === "true" ? "Anime you've completed will appear here" : "Ended shows you've completed will appear here"} />
      ) : (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {items.map((s: any) => (
              <FinishedShowCard key={s.id} show={s} onGo={() => onGo(s.tmdbId)} />
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

function UpToDateTab({ onGo }: { onGo: (id: number) => void }) {
  const [page, setPage] = useState(0);
  const limit = 60;
  // Filter by status=uptodate — shows where user watched all aired episodes but show is still ongoing
  const uptodate = useMedia({ type: "series", status: "uptodate", sortBy: "title", order: "asc", limit, offset: page * limit });

  const items = uptodate.data?.items ?? [];
  const total = uptodate.data?.total ?? 0;
  const totalPages = Math.ceil(total / limit);

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 px-1">
        <Zap className="w-5 h-5 text-cyan-400" />
        <h2 className="text-lg sm:text-xl font-bold tracking-tight">Up To Date</h2>
        <span className="text-xs text-muted-foreground ml-1">({total})</span>
      </div>
      <p className="text-xs text-muted-foreground px-1 -mt-2">
        You've watched all aired episodes, but the show is <strong>still ongoing</strong> — more seasons are coming.
      </p>

      {uptodate.isLoading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {Array.from({ length: 12 }).map((_, i) => (
            <div key={i} className="h-[100px] shimmer rounded-lg" />
          ))}
        </div>
      ) : items.length === 0 ? (
        <EmptyTab icon={<Zap className="w-10 h-10" />} title="No shows up to date" subtitle="Catch up on all aired episodes of an ongoing show to see it here" />
      ) : (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {items.map((s: any) => (
              <UpToDateShowCard key={s.id} show={s} onGo={() => onGo(s.tmdbId)} />
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

function UpToDateShowCard({ show, onGo }: { show: any; onGo: () => void }) {
  const userRating = null;
  const totalEps = show.episodes;

  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
      <Card className="p-3 flex gap-3 group hover:border-primary/40 hover:shadow-lg hover:shadow-primary/5 transition-all cursor-pointer" onClick={onGo}>
        <div className="w-14 h-20 rounded-md overflow-hidden bg-muted flex-shrink-0 relative">
          {show.poster ? (
            <img src={img(show.poster, "w92")} alt={show.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform" loading="lazy" />
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
            <Badge className="text-[9px] bg-cyan-500/20 text-cyan-400 border-0">
              <Zap className="w-2.5 h-2.5 mr-1" /> Up To Date
            </Badge>
            {show.isAnime && <Badge className="text-[9px] bg-purple-500/20 text-purple-400 border-0">Anime</Badge>}
            {show.seasons && <Badge variant="secondary" className="text-[10px]">{show.seasons} season{show.seasons > 1 ? "s" : ""}</Badge>}
            <Badge className="text-[9px] bg-emerald-500/20 text-emerald-400 border-0">Returning</Badge>
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
  const statusBadge = <Badge className="text-[9px] bg-rose-500/20 text-rose-400 border-0">Ended</Badge>;
  const userRating = show.userRating;
  const totalEps = show.episodes;

  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
      <Card className="p-3 flex gap-3 group hover:border-primary/40 hover:shadow-lg hover:shadow-primary/5 transition-all cursor-pointer" onClick={onGo}>
        <div className="w-14 h-20 rounded-md overflow-hidden bg-muted flex-shrink-0 relative">
          {show.poster ? (
            <img src={img(show.poster, "w92")} alt={show.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform" loading="lazy" />
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
            <Badge className="text-[9px] bg-emerald-500/20 text-emerald-400 border-0">
              <CheckCircle2 className="w-2.5 h-2.5 mr-1" /> Finished
            </Badge>
            {show.isAnime && <Badge className="text-[9px] bg-purple-500/20 text-purple-400 border-0">Anime</Badge>}
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
                className="h-6 text-[10px] px-2"
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

function UpcomingTab({ shows, onGo }: { shows: any[]; onGo: (id: number) => void }) {
  return (
    <div className="space-y-3">
      <p className="text-sm text-muted-foreground px-1">Shows with upcoming new episodes</p>
      <UpcomingList shows={shows} onGo={onGo} />
    </div>
  );
}

function HaventWatchedWhileTab({ shows, onGo }: { shows: any[]; onGo: (id: number) => void }) {
  return (
    <div className="space-y-3">
      <p className="text-sm text-muted-foreground px-1">Shows with at least one released episode you have not watched yet</p>
      <HaventWatchedList shows={shows} onGo={onGo} type="while" />
    </div>
  );
}

function HaventStartedTab({ shows, onGo }: { shows: any[]; onGo: (id: number) => void }) {
  return (
    <div className="space-y-3">
      <p className="text-sm text-muted-foreground px-1">Shows you're following but haven't started watching yet</p>
      <HaventWatchedList shows={shows} onGo={onGo} type="started" />
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

  // Dialog state for "Make Previous Episodes"
  const [prevEpDialog, setPrevEpDialog] = useState<{
    open: boolean;
    currentEp: { seasonNumber: number; episode: any } | null;
    prevEpisodes: { seasonNumber: number; episodeNumber: number; episodeName?: string }[];
  }>({ open: false, currentEp: null, prevEpisodes: [] });

  const { nextEp, totalEpisodes, watchedCount, watchedSet, seasons, allEpisodes, isLoading } = data;
  const progress = totalEpisodes > 0 ? Math.round((watchedCount / totalEpisodes) * 100) : 0;
  const remaining = Math.max(0, totalEpisodes - watchedCount);

  const markWatched = async () => {
    if (!nextEp) return;
    // Check if there are previous unwatched episodes in the same season
    const seasonData = seasons.find((s) => s.seasonNumber === nextEp.seasonNumber);
    if (seasonData) {
      const prevUnwatched = seasonData.episodes
        .filter((e: any) => e.episode_number < nextEp.episode.episode_number && !watchedSet.has(`${e.season_number}-${e.episode_number}`))
        .map((e: any) => ({ seasonNumber: e.season_number, episodeNumber: e.episode_number, episodeName: e.name }));

      if (prevUnwatched.length > 0) {
        // Show "Make Previous Episodes" dialog
        setPrevEpDialog({
          open: true,
          currentEp: { seasonNumber: nextEp.seasonNumber, episode: nextEp.episode },
          prevEpisodes: prevUnwatched,
        });
        return;
      }
    }
    // No previous unwatched episodes, just mark this one
    try {
      const result = await episodeToggle.mutateAsync({
        action: "add",
        showId,
        seasonNumber: nextEp.seasonNumber,
        episodeNumber: nextEp.episode.episode_number,
        episodeName: nextEp.episode.name,
      });
      toast.success(`Marked S${nextEp.seasonNumber}E${nextEp.episode.episode_number} as watched`);
      if (onCompletion) onCompletion(result?.completion);
    } catch {
      toast.error("Failed to mark episode");
    }
  };

  const handleMarkAllPrevious = async () => {
    if (!prevEpDialog.currentEp) return;
    // Mark all previous episodes + current episode
    const allEps = [...prevEpDialog.prevEpisodes, {
      seasonNumber: prevEpDialog.currentEp.seasonNumber,
      episodeNumber: prevEpDialog.currentEp.episode.episode_number,
      episodeName: prevEpDialog.currentEp.episode.name,
    }];
    try {
      const result = await bulkToggle.mutateAsync({ showId, episodes: allEps });
      toast.success(`Marked ${allEps.length} episodes as watched (including previous)`);
      if (onCompletion) onCompletion(result?.completion);
    } catch {
      toast.error("Failed to mark episodes");
    }
    setPrevEpDialog({ open: false, currentEp: null, prevEpisodes: [] });
  };

  const handleMarkOnlyCurrent = async () => {
    if (!prevEpDialog.currentEp) return;
    try {
      const result = await episodeToggle.mutateAsync({
        action: "add",
        showId,
        seasonNumber: prevEpDialog.currentEp.seasonNumber,
        episodeNumber: prevEpDialog.currentEp.episode.episode_number,
        episodeName: prevEpDialog.currentEp.episode.name,
      });
      toast.success(`Marked S${prevEpDialog.currentEp.seasonNumber}E${prevEpDialog.currentEp.episode.episode_number} as watched`);
      if (onCompletion) onCompletion(result?.completion);
    } catch {
      toast.error("Failed to mark episode");
    }
    setPrevEpDialog({ open: false, currentEp: null, prevEpisodes: [] });
  };

  const markAllSeason = async () => {
    if (!nextEp) return;
    const unwatched = allEpisodes
      .filter(({ seasonNumber, episode }) =>
        seasonNumber === nextEp.seasonNumber
        && !watchedSet.has(`${episode.season_number}-${episode.episode_number}`),
      )
      .map(({ episode }) => ({
        seasonNumber: episode.season_number,
        episodeNumber: episode.episode_number,
        episodeName: episode.name,
      }));
    if (unwatched.length === 0) { toast.info("All episodes already watched"); return; }
    try {
      const result = await bulkToggle.mutateAsync({ showId, episodes: unwatched });
      toast.success(`Marked ${unwatched.length} episodes as watched`);
      if (onCompletion) onCompletion(result?.completion);
    } catch {
      toast.error("Failed to mark episodes");
    }
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
              {poster ? <img src={img(poster, "w185")} alt={title} className="w-full h-full object-cover" loading="lazy" /> : <div className="w-full h-full flex items-center justify-center"><Tv className="w-6 h-6 text-muted-foreground" /></div>}
              <div className="absolute inset-0 bg-emerald-500/20 flex items-center justify-center">
                <CheckCircle2 className="w-8 h-8 text-emerald-400" />
              </div>
            </button>
            <div className="flex-1 p-3 flex flex-col">
              <p className="text-[10px] text-emerald-400 font-bold uppercase tracking-wide">All caught up!</p>
              <p className="text-sm font-semibold line-clamp-1 mt-0.5">{title}</p>
              <div className="flex items-center gap-2 mt-1">
                <Badge variant="secondary" className="text-[9px] bg-emerald-500/15 text-emerald-400">{watchedCount}/{totalEpisodes} eps</Badge>
                <Badge variant="secondary" className="text-[9px]">100%</Badge>
              </div>
              <Button size="sm" variant="outline" className="h-7 text-xs mt-auto w-fit" onClick={onGo}>
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
        <button onClick={onGo} className="w-16 h-20 rounded-md overflow-hidden bg-muted flex-shrink-0">
          {poster ? <img src={img(poster, "w92")} alt={title} className="w-full h-full object-cover" /> : <div className="w-full h-full flex items-center justify-center"><Tv className="w-5 h-5 text-muted-foreground" /></div>}
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
                <img src={img(ep.still_path, "w300")} alt={ep.name} className="w-full h-full object-cover group-hover:scale-105 transition-transform" loading="lazy" />
              ) : poster ? (
                <img src={img(poster, "w185")} alt={title} className="w-full h-full object-cover" loading="lazy" />
              ) : (
                <div className="w-full h-full flex items-center justify-center"><Tv className="w-6 h-6 text-muted-foreground" /></div>
              )}
              <span className="absolute top-1 left-1 bg-background/90 backdrop-blur text-[10px] font-bold px-1.5 py-0.5 rounded">
                S{nextEp.seasonNumber}E{ep.episode_number}
              </span>
              {featured && (
                <span className="absolute bottom-1 right-1 bg-primary text-primary-foreground text-[9px] font-bold px-1.5 py-0.5 rounded uppercase tracking-wide">
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
            <Button size="sm" className="h-7 text-xs flex-1" onClick={markWatched} disabled={episodeToggle.isPending || bulkToggle.isPending}>
              <Play className="w-3 h-3 mr-1 fill-current" /> Mark watched
            </Button>
            <Button size="sm" variant="outline" className="h-7 text-xs" onClick={markAllSeason} title="Mark rest of season watched">
              <SkipForward className="w-3 h-3 mr-1" /> Season
            </Button>
            <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={onGo} aria-label="Open show">
              <ChevronRight className="w-4 h-4" />
            </Button>
          </div>
        </Card>
      </motion.div>

      {/* Make Previous Episodes dialog */}
      <AlertDialog open={prevEpDialog.open} onOpenChange={(open) => !open && setPrevEpDialog({ open: false, currentEp: null, prevEpisodes: [] })}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertCircle className="w-5 h-5 text-amber-400" />
              Make Previous Episodes?
            </AlertDialogTitle>
            <AlertDialogDescription>
              You're marking <strong>S{prevEpDialog.currentEp?.seasonNumber}E{prevEpDialog.currentEp?.episode.episode_number}</strong> as watched, but there {prevEpDialog.prevEpisodes.length === 1 ? "is" : "are"} <strong>{prevEpDialog.prevEpisodes.length} episode{prevEpDialog.prevEpisodes.length === 1 ? "" : "s"}</strong> before it that you haven't watched yet.
              <br /><br />
              Do you want to mark all previous episodes as watched?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={handleMarkOnlyCurrent}>
              No, just this episode
            </AlertDialogCancel>
            <AlertDialogAction onClick={handleMarkAllPrevious} className="bg-primary text-primary-foreground hover:bg-primary/90">
              Yes, mark all {prevEpDialog.prevEpisodes.length + 1} episodes
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
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
    ? <Badge className="text-[9px] bg-purple-500/20 text-purple-400 border-0">Not Started</Badge>
    : null;

  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
      <Card className="p-3 flex gap-3 group hover:border-primary/40 hover:shadow-lg hover:shadow-primary/5 transition-all cursor-pointer" onClick={onGo}>
        <div className="w-14 h-20 rounded-md overflow-hidden bg-muted flex-shrink-0">
          {poster ? (
            <img src={img(poster, "w92")} alt={title} className="w-full h-full object-cover group-hover:scale-105 transition-transform" loading="lazy" />
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
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
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
        <div className="w-14 h-20 rounded-md overflow-hidden bg-muted flex-shrink-0">
          {poster ? <img src={img(poster, "w92")} alt={title} className="w-full h-full object-cover" loading="lazy" /> : <div className="w-full h-full flex items-center justify-center"><Tv className="w-5 h-5 text-muted-foreground" /></div>}
        </div>
        <div className="flex-1 min-w-0 flex flex-col">
          <h4 className="font-semibold text-sm line-clamp-1 group-hover:text-primary transition-colors">{title}</h4>
          <div className="flex items-center gap-1 mt-1 flex-wrap">
            <Badge className="text-[9px] bg-amber-500/20 text-amber-400 border-0">
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
    return <Badge className="text-[9px] bg-rose-500/20 text-rose-400 border-0">Ended</Badge>;
  }
  if (s.includes("returning") || s.includes("continuous") || s.includes("production")) {
    return <Badge className="text-[9px] bg-emerald-500/20 text-emerald-400 border-0">Returning</Badge>;
  }
  return <Badge variant="secondary" className="text-[9px]">{status}</Badge>;
}

// ============ HAVEN'T WATCHED / HAVEN'T STARTED LIST ============

function HaventWatchedList({ shows, onGo, type }: { shows: any[]; onGo: (id: number) => void; type: "while" | "started" }) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
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
        <div className="w-14 h-20 rounded-md overflow-hidden bg-muted flex-shrink-0">
          {poster ? <img src={img(poster, "w92")} alt={title} className="w-full h-full object-cover" loading="lazy" /> : <div className="w-full h-full flex items-center justify-center"><Tv className="w-5 h-5 text-muted-foreground" /></div>}
        </div>
        <div className="flex-1 min-w-0 flex flex-col">
          <h4 className="font-semibold text-sm line-clamp-1 group-hover:text-primary transition-colors">{title}</h4>
          <div className="flex items-center gap-1 mt-1 flex-wrap">
            {type === "started" ? (
              <Badge className="text-[9px] bg-purple-500/20 text-purple-400 border-0">
                <Sparkles className="w-2.5 h-2.5 mr-1" /> Not started
              </Badge>
            ) : (
              <Badge className="text-[9px] bg-amber-500/20 text-amber-400 border-0">
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
