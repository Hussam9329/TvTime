"use client";

import { useFollowing, useStats, useTvDetail, useWatchedEpisodes, useSeasonDetail, useEpisodeToggle } from "@/hooks/use-tmdb";
import { useNav } from "@/lib/store";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Play, ChevronRight, Tv, Loader2, CheckCircle2, Clock, Calendar, SkipForward, ListChecks, TrendingUp, BarChart3, Clapperboard } from "lucide-react";
import { img } from "@/lib/tmdb";
import { motion } from "framer-motion";
import { toast } from "sonner";
import { useState } from "react";

export function TvTrackingView() {
  const following = useFollowing();
  const stats = useStats();
  const goTv = useNav((s) => s.goTv);
  const setView = useNav((s) => s.setView);

  const followed = following.data?.items ?? [];
  const followedWithTmdb = followed.filter((s: any) => s.tmdbId);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="w-12 h-12 rounded-xl bg-primary/15 flex items-center justify-center">
          <Clapperboard className="w-6 h-6 text-primary" />
        </div>
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight">TV Tracking</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Track your shows, episodes, and progress</p>
        </div>
      </div>

      {/* Stats row */}
      {stats.data && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <StatCard icon={<Tv className="w-5 h-5" />} label="Following" value={stats.data.counts.following} color="from-purple-500/20 to-purple-500/5" />
          <StatCard icon={<CheckCircle2 className="w-5 h-5" />} label="Rated Shows" value={stats.data.counts.rated - stats.data.counts.watchedMovies} color="from-emerald-500/20 to-emerald-500/5" />
          <StatCard icon={<Play className="w-5 h-5" />} label="Watchlist TV" value={stats.data.counts.watchlistShows} color="from-rose-500/20 to-rose-500/5" />
          <StatCard icon={<Clock className="w-5 h-5" />} label="Watch Time" value={stats.data.watchTime?.totalHours || 0} suffix="h" color="from-amber-500/20 to-amber-500/5" />
        </div>
      )}

      {/* Continue Watching - Next Episodes */}
      {followedWithTmdb.length > 0 && (
        <section>
          <div className="flex items-center justify-between mb-3 px-1">
            <div className="flex items-center gap-2">
              <Play className="w-5 h-5 text-primary fill-primary" />
              <h2 className="text-lg sm:text-xl font-bold tracking-tight">Continue Watching</h2>
              <span className="text-xs text-muted-foreground ml-1">Next episodes</span>
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {followedWithTmdb.slice(0, 10).map((s: any, i) => (
              <NextEpisodeCard
                key={s.id}
                showId={s.tmdbId}
                title={s.title}
                poster={s.poster}
                onGo={() => goTv(s.tmdbId)}
                featured={i === 0}
              />
            ))}
          </div>
        </section>
      )}

      {/* All Shows with progress */}
      {followed.length > 0 && (
        <section>
          <div className="flex items-center justify-between mb-3 px-1">
            <div className="flex items-center gap-2">
              <ListChecks className="w-5 h-5 text-primary" />
              <h2 className="text-lg sm:text-xl font-bold tracking-tight">Your Shows</h2>
              <span className="text-xs text-muted-foreground ml-1">({followed.length})</span>
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {followed.slice(0, 30).map((s: any, i) => (
              <ShowProgressCard key={s.id} showId={s.tmdbId} title={s.title} poster={s.poster} onGo={() => goTv(s.tmdbId)} />
            ))}
          </div>
          {followed.length > 30 && (
            <div className="text-center mt-4">
              <Button variant="outline" size="sm" onClick={() => setView("library")}>
                View all {followed.length} shows <ChevronRight className="w-4 h-4 ml-1" />
              </Button>
            </div>
          )}
        </section>
      )}

      {/* Empty state */}
      {following.data && followed.length === 0 && (
        <Card className="p-12 text-center text-muted-foreground">
          <Tv className="w-12 h-12 mx-auto mb-3 opacity-40" />
          <p className="font-medium text-foreground text-lg">Not following any shows</p>
          <p className="text-sm mt-1">Follow TV shows to track their episodes and progress</p>
          <Button className="mt-4" onClick={() => setView("discover")}>Discover shows</Button>
        </Card>
      )}
    </div>
  );
}

function StatCard({ icon, label, value, suffix, color }: { icon: React.ReactNode; label: string; value: number; suffix?: string; color: string }) {
  return (
    <Card className={`p-4 relative overflow-hidden bg-gradient-to-br ${color}`}>
      <div className="relative">
        <div className="w-9 h-9 rounded-lg bg-background/50 backdrop-blur flex items-center justify-center text-primary mb-2">{icon}</div>
        <p className="text-2xl font-extrabold">{value}{suffix && <span className="text-sm text-muted-foreground font-normal">{suffix}</span>}</p>
        <p className="text-xs text-muted-foreground">{label}</p>
      </div>
    </Card>
  );
}

function NextEpisodeCard({ showId, title, poster, onGo, featured }: {
  showId: number;
  title: string;
  poster: string | null;
  onGo: () => void;
  featured?: boolean;
}) {
  const showDetail = useTvDetail(showId);
  const watched = useWatchedEpisodes(showId);
  const s1 = useSeasonDetail(showId, 1);
  const s2 = useSeasonDetail(showId, 2);
  const s3 = useSeasonDetail(showId, 3);
  const s4 = useSeasonDetail(showId, 4);

  const episodeToggle = useEpisodeToggle();

  const watchedSet = new Set(
    (watched.data?.items ?? []).map((e: any) => `${e.seasonNumber}-${e.episodeNumber}`)
  );

  const seasons = [s1, s2, s3, s4].filter((s) => s.data?.episodes?.length);
  const totalEpisodes = showDetail.data?.number_of_episodes ?? 0;
  const watchedCount = watchedSet.size;

  let nextEp: { seasonNumber: number; episode: any; seasonName: string } | null = null;
  let allSeasonsData: { seasonNumber: number; episodes: any[]; seasonName: string }[] = [];

  for (const s of seasons) {
    if (!s.data) continue;
    allSeasonsData.push({ seasonNumber: s.data.season_number, episodes: s.data.episodes, seasonName: s.data.name });
    const unwatched = s.data.episodes.find((e) => !watchedSet.has(`${e.season_number}-${e.episode_number}`));
    if (unwatched && !nextEp) {
      nextEp = { seasonNumber: s.data.season_number, episode: unwatched, seasonName: s.data.name };
    }
  }

  const isLoading = s1.isLoading || s2.isLoading || s3.isLoading || s4.isLoading || watched.isLoading || showDetail.isLoading;
  const allWatched = !isLoading && seasons.length > 0 && !nextEp;
  const remaining = totalEpisodes > 0 ? totalEpisodes - watchedCount : 0;
  const progress = totalEpisodes > 0 ? Math.round((watchedCount / totalEpisodes) * 100) : 0;

  const markWatched = () => {
    if (!nextEp) return;
    episodeToggle.mutate({
      action: "add",
      showId,
      seasonNumber: nextEp.seasonNumber,
      episodeNumber: nextEp.episode.episode_number,
      episodeName: nextEp.episode.name,
    });
    toast.success(`Marked S${nextEp.seasonNumber}E${nextEp.episode.episode_number} as watched`);
  };

  const markAllSeason = () => {
    if (!nextEp) return;
    const seasonData = allSeasonsData.find((s) => s.seasonNumber === nextEp!.seasonNumber);
    if (!seasonData) return;
    const unwatched = seasonData.episodes
      .filter((e) => !watchedSet.has(`${e.season_number}-${e.episode_number}`))
      .map((e) => ({ seasonNumber: e.season_number, episodeNumber: e.episode_number, episodeName: e.name }));
    if (unwatched.length === 0) { toast.info("All episodes already watched"); return; }
    unwatched.forEach((ep) => { episodeToggle.mutate({ action: "add", showId, ...ep }); });
    toast.success(`Marked ${unwatched.length} episodes as watched`);
  };

  if (isLoading) {
    return (
      <Card className="p-3 h-[200px] flex items-center gap-3">
        <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
        <span className="text-sm text-muted-foreground">Loading {title}...</span>
      </Card>
    );
  }

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
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
    >
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
            {/* Progress */}
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
        {/* Actions */}
        <div className="flex items-center gap-1.5 p-2.5 pt-2 border-t border-border/40">
          <Button size="sm" className="h-7 text-xs flex-1" onClick={markWatched} disabled={episodeToggle.isPending}>
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
  );
}

function ShowProgressCard({ showId, title, poster, onGo }: { showId: number; title: string; poster: string | null; onGo: () => void }) {
  const showDetail = useTvDetail(showId);
  const watched = useWatchedEpisodes(showId);

  const totalEpisodes = showDetail.data?.number_of_episodes ?? 0;
  const watchedCount = watched.data?.items.length ?? 0;
  const progress = totalEpisodes > 0 ? Math.round((watchedCount / totalEpisodes) * 100) : 0;
  const remaining = totalEpisodes > 0 ? totalEpisodes - watchedCount : 0;
  const seasons = showDetail.data?.number_of_seasons;
  const status = showDetail.data?.status;
  const isLoading = showDetail.isLoading || watched.isLoading;

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
    >
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
            {status && <Badge variant="secondary" className="text-[10px]">{status}</Badge>}
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
                <span className="font-bold text-primary">{progress}%</span>
              </div>
              <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                <div className="h-full bg-gradient-to-r from-primary to-purple-500 transition-all duration-500" style={{ width: `${progress}%` }} />
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
