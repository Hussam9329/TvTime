"use client";

import { useFollowing, useShowProgress, useEpisodeToggle, useBulkEpisodeToggle } from "@/hooks/use-tmdb";
import { useNav } from "@/lib/store";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { EpisodeWatchConfirmationDialog } from "@/components/media/episode-watch-confirmation-dialog";
import { Play, ChevronRight, Tv, Loader2, CheckCircle2, Clock, Calendar, SkipForward } from "lucide-react";
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

/**
 * Continue Watching - the core TV Time feature.
 * For each followed show, finds the next unwatched episode,
 * shows progress, remaining episodes, and allows marking as watched.
 */
export function ContinueWatching() {
  const following = useFollowing();
  const goTv = useNav((s) => s.goTv);
  const followed = following.data?.items ?? [];

  if (following.isLoading || followed.length === 0) return null;

  return (
    <section className="mb-8">
      <div className="flex items-center justify-between mb-3 px-1">
        <div className="flex items-center gap-2">
          <Play className="w-5 h-5 text-primary fill-primary" />
          <h2 className="text-lg sm:text-xl font-bold tracking-tight">Continue Watching</h2>
          <span className="text-xs text-muted-foreground ml-1">Next episodes</span>
        </div>
        <Button variant="ghost" size="sm" className="text-xs hidden sm:flex" onClick={() => goTv((followed[0] as any)?.tmdbId || 0)}>
          Track all <ChevronRight className="w-3.5 h-3.5 ml-1" />
        </Button>
      </div>
      <div className="flex gap-3 overflow-x-auto no-scrollbar pb-2">
        {followed.slice(0, 10).map((s, i) => (
          <NextEpisodeCard
            key={s.id}
            showId={(s as any).tmdbId || 0}
            title={s.title}
            poster={(s as any).poster || (s as any).posterPath}
            onGo={() => goTv((s as any).tmdbId || 0)}
            featured={i === 0}
          />
        ))}
      </div>
    </section>
  );
}

function NextEpisodeCard({ showId, title, poster, onGo, featured }: {
  showId: number;
  title: string;
  poster: string | null;
  onGo: () => void;
  featured?: boolean;
}) {
  // Fetch full show progress (all seasons + watched episodes via API)
  const data = useShowProgress(showId);
  const { watchedSet, watchedCount, totalEpisodes, nextEp, allEpisodes, isLoading } = data;

  const episodeToggle = useEpisodeToggle();
  const bulkToggle = useBulkEpisodeToggle();
  const [watchPlan, setWatchPlan] = useState<EpisodeWatchPlan | null>(null);

  const allWatched = !isLoading && totalEpisodes > 0 && !nextEp;
  const remaining = Math.max(0, totalEpisodes - watchedCount);
  const progress = totalEpisodes > 0 ? Math.round((watchedCount / totalEpisodes) * 100) : 0;

  const releasedTimeline = progressEpisodesToWatchRefs(allEpisodes);

  const applyWatchPlan = async (plan: EpisodeWatchPlan, includePrevious: boolean) => {
    const episodes = includePrevious ? plan.allEpisodes : plan.selectedEpisodes;
    if (episodes.length === 0) {
      setWatchPlan(null);
      return;
    }
    try {
      await (episodes.length === 1
        ? episodeToggle.mutateAsync({
            action: "add",
            showId,
            seasonNumber: episodes[0].seasonNumber,
            episodeNumber: episodes[0].episodeNumber,
            episodeName: episodes[0].episodeName || undefined,
          })
        : bulkToggle.mutateAsync({ showId, episodes }));
      toast.success(
        includePrevious && plan.previousUnwatched.length > 0
          ? `Marked ${episodes.length} released episodes as watched, including earlier gaps.`
          : `${plan.targetLabel} marked as watched.`,
      );
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

  // Loading state
  if (isLoading) {
    return (
      <div className={featured ? "flex-shrink-0 w-[340px] sm:w-[400px]" : "flex-shrink-0 w-[280px] sm:w-[320px]"}>
        <Card className="p-3 h-[140px] flex items-center gap-3">
          <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
          <span className="text-sm text-muted-foreground">Loading episodes...</span>
        </Card>
      </div>
    );
  }

  // All caught up state
  if (allWatched) {
    return (
      <motion.div
        initial={{ opacity: 0, x: -8 }}
        animate={{ opacity: 1, x: 0 }}
        className={featured ? "flex-shrink-0 w-[340px] sm:w-[400px]" : "flex-shrink-0 w-[280px] sm:w-[320px]"}
      >
        <Card className="overflow-hidden p-0 border-emerald-500/30 bg-emerald-500/5 hover:border-emerald-500/50 transition-all group">
          <div className="flex">
            <button onClick={onGo} className="relative w-24 h-24 flex-shrink-0 overflow-hidden bg-muted">
              {poster ? (
                <img src={img(poster, "w185")} alt={title} className="w-full h-full object-cover" loading="lazy" />
              ) : (
                <div className="w-full h-full flex items-center justify-center"><Tv className="w-6 h-6 text-muted-foreground" /></div>
              )}
              <div className="absolute inset-0 bg-emerald-500/20 flex items-center justify-center">
                <CheckCircle2 className="w-8 h-8 text-emerald-400" />
              </div>
            </button>
            <div className="flex-1 p-3 flex flex-col">
              <p className="text-[10px] text-emerald-400 font-bold uppercase tracking-wide">All caught up!</p>
              <p className="text-sm font-semibold line-clamp-1 mt-0.5">{title}</p>
              <div className="flex items-center gap-2 mt-1">
                <Badge variant="secondary" className="text-[9px] bg-emerald-500/15 text-emerald-400">
                  {watchedCount}/{totalEpisodes} eps
                </Badge>
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

  // No episode data available
  if (!nextEp) {
    return (
      <motion.div
        initial={{ opacity: 0, x: -8 }}
        animate={{ opacity: 1, x: 0 }}
        className="flex-shrink-0 w-[280px] sm:w-[320px]"
      >
        <Card className="p-3 h-[140px] flex items-center gap-3 hover:border-primary/40 transition-colors">
          <button onClick={onGo} className="w-16 h-20 rounded-md overflow-hidden bg-muted flex-shrink-0">
            {poster ? <img src={img(poster, "w92")} alt={title} className="w-full h-full object-cover" /> : <div className="w-full h-full flex items-center justify-center"><Tv className="w-5 h-5 text-muted-foreground" /></div>}
          </button>
          <div>
            <p className="text-sm font-semibold line-clamp-1">{title}</p>
            <p className="text-xs text-muted-foreground mt-1">Tap to explore seasons</p>
          </div>
        </Card>
      </motion.div>
    );
  }

  const ep = nextEp.episode;
  const epRuntime = ep.runtime ? `${ep.runtime}m` : null;
  const epAirDate = ep.air_date ? new Date(ep.air_date).toLocaleDateString("en-US", { month: "short", day: "numeric" }) : null;

  return (
    <motion.div
      initial={{ opacity: 0, x: -8 }}
      animate={{ opacity: 1, x: 0 }}
      className={featured ? "flex-shrink-0 w-[340px] sm:w-[400px]" : "flex-shrink-0 w-[280px] sm:w-[320px]"}
    >
      <Card className={`overflow-hidden p-0 hover:border-primary/50 transition-all group ${featured ? "ring-2 ring-primary/30 shadow-lg shadow-primary/10" : ""}`}>
        {/* Top: episode still + info */}
        <div className="flex">
          <button onClick={onGo} className="relative w-24 h-24 flex-shrink-0 overflow-hidden bg-muted">
            {ep.still_path ? (
              <img src={img(ep.still_path, "w300")} alt={ep.name} className="w-full h-full object-cover group-hover:scale-105 transition-transform" loading="lazy" />
            ) : poster ? (
              <img src={img(poster, "w185")} alt={title} className="w-full h-full object-cover" loading="lazy" />
            ) : (
              <div className="w-full h-full flex items-center justify-center"><Tv className="w-6 h-6 text-muted-foreground" /></div>
            )}
            {/* SxxExx badge */}
            <span className="absolute top-1 left-1 bg-background/90 backdrop-blur text-[10px] font-bold px-1.5 py-0.5 rounded">
              S{nextEp.seasonNumber}E{ep.episode_number}
            </span>
            {/* Watch Next badge for featured */}
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
              {epAirDate && (
                <span className="text-[10px] text-muted-foreground flex items-center gap-0.5">
                  <Calendar className="w-2.5 h-2.5" /> {epAirDate}
                </span>
              )}
              {epRuntime && (
                <span className="text-[10px] text-muted-foreground flex items-center gap-0.5">
                  <Clock className="w-2.5 h-2.5" /> {epRuntime}
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Bottom: progress bar + actions */}
        <div className="p-2.5 pt-2 border-t border-border/40">
          {/* Progress */}
          {totalEpisodes > 0 && (
            <div className="mb-2">
              <div className="flex items-center justify-between text-[10px] text-muted-foreground mb-0.5">
                <span>{watchedCount} watched</span>
                <span className="font-bold text-primary">{progress}%</span>
              </div>
              <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                <div className="h-full bg-gradient-to-r from-primary to-purple-500 transition-all duration-500" style={{ width: `${progress}%` }} />
              </div>
              <div className="flex items-center justify-between text-[10px] text-muted-foreground mt-0.5">
                <span>{remaining} remaining of {totalEpisodes}</span>
              </div>
            </div>
          )}

          {/* Actions */}
          <div className="flex items-center gap-1.5">
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
        </div>
      </Card>
      <EpisodeWatchConfirmationDialog
        plan={watchPlan}
        open={Boolean(watchPlan)}
        pending={episodeToggle.isPending || bulkToggle.isPending}
        onOpenChange={(nextOpen) => { if (!nextOpen) setWatchPlan(null); }}
        onSelectedOnly={() => watchPlan ? applyWatchPlan(watchPlan, false) : undefined}
        onWithPrevious={() => watchPlan ? applyWatchPlan(watchPlan, true) : undefined}
      />
    </motion.div>
  );
}
