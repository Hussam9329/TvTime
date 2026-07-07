"use client";

import { useFollowing, useWatchedEpisodes, useSeasonDetail } from "@/hooks/use-tmdb";
import { useNav } from "@/lib/store";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Play, ChevronRight, Tv, Loader2, CheckCircle2 } from "lucide-react";
import { img } from "@/lib/tmdb";
import { motion } from "framer-motion";
import { toast } from "sonner";
import { useEpisodeToggle } from "@/hooks/use-tmdb";

/**
 * Continue Watching section - finds the next unwatched episode for each followed show
 * and lets the user mark it as watched directly.
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
      </div>
      <div className="flex gap-3 overflow-x-auto no-scrollbar pb-2">
        {followed.slice(0, 10).map((s) => (
          <ContinueCard key={s.id} showId={s.tmdbId} title={s.title} posterPath={s.posterPath} onGo={() => goTv(s.tmdbId)} />
        ))}
      </div>
    </section>
  );
}

function ContinueCard({ showId, title, posterPath, onGo }: { showId: number; title: string; posterPath: string | null; onGo: () => void }) {
  // We need to find the next unwatched episode.
  // Strategy: fetch watched episodes for this show, then iterate seasons starting from 1,
  // fetch each season's episodes, find the first unwatched one.
  const watched = useWatchedEpisodes(showId);
  // Start with season 1, incrementally fetch until we find an unwatched episode or run out of seasons.
  // To keep it simple, we fetch seasons 1, 2, 3 in parallel and pick the first unwatched.
  const s1 = useSeasonDetail(showId, 1);
  const s2 = useSeasonDetail(showId, 2);
  const s3 = useSeasonDetail(showId, 3);

  const episodeToggle = useEpisodeToggle();
  const goTv = useNav((s) => s.goTv);

  const watchedSet = new Set(
    (watched.data?.items ?? []).map((e) => `${e.seasonNumber}-${e.episodeNumber}`)
  );

  const seasons = [s1, s2, s3].filter((s) => s.data?.episodes?.length);
  let nextEp: { seasonNumber: number; episode: any; seasonName: string } | null = null;
  for (const s of seasons) {
    if (!s.data) continue;
    const unwatched = s.data.episodes.find((e) => !watchedSet.has(`${e.season_number}-${e.episode_number}`));
    if (unwatched) {
      nextEp = { seasonNumber: s.data.season_number, episode: unwatched, seasonName: s.data.name };
      break;
    }
  }

  const isLoading = s1.isLoading || s2.isLoading || s3.isLoading || watched.isLoading;
  const allWatched = !isLoading && seasons.length > 0 && !nextEp;

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

  if (isLoading) {
    return (
      <div className="flex-shrink-0 w-[260px]">
        <Card className="p-3 h-[120px] flex items-center gap-3">
          <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
          <span className="text-sm text-muted-foreground">Loading...</span>
        </Card>
      </div>
    );
  }

  if (!nextEp && !allWatched) {
    // No season data available
    return (
      <button onClick={onGo} className="flex-shrink-0 w-[260px] text-left">
        <Card className="p-3 h-[120px] flex items-center gap-3 hover:border-primary/40 transition-colors">
          <div className="w-12 h-16 rounded-md overflow-hidden bg-muted flex-shrink-0">
            {posterPath ? <img src={img(posterPath, "w92")} alt={title} className="w-full h-full object-cover" /> : <div className="w-full h-full flex items-center justify-center"><Tv className="w-5 h-5 text-muted-foreground" /></div>}
          </div>
          <div className="min-w-0">
            <p className="text-sm font-semibold line-clamp-1">{title}</p>
            <p className="text-xs text-muted-foreground mt-1">Tap to explore seasons</p>
          </div>
        </Card>
      </button>
    );
  }

  if (allWatched) {
    return (
      <button onClick={onGo} className="flex-shrink-0 w-[260px] text-left">
        <Card className="p-3 h-[120px] flex items-center gap-3 border-emerald-500/30 bg-emerald-500/5 hover:border-emerald-500/50 transition-colors">
          <div className="w-12 h-16 rounded-md overflow-hidden bg-muted flex-shrink-0 relative">
            {posterPath ? <img src={img(posterPath, "w92")} alt={title} className="w-full h-full object-cover" /> : <div className="w-full h-full flex items-center justify-center"><Tv className="w-5 h-5 text-muted-foreground" /></div>}
            <div className="absolute inset-0 bg-emerald-500/20 flex items-center justify-center">
              <CheckCircle2 className="w-6 h-6 text-emerald-400" />
            </div>
          </div>
          <div className="min-w-0">
            <p className="text-sm font-semibold line-clamp-1">{title}</p>
            <p className="text-xs text-emerald-400 mt-1 font-medium">All caught up!</p>
            <p className="text-[10px] text-muted-foreground mt-0.5">Tap to explore more</p>
          </div>
        </Card>
      </button>
    );
  }

  const ep = nextEp!.episode;
  return (
    <motion.div
      initial={{ opacity: 0, x: -8 }}
      animate={{ opacity: 1, x: 0 }}
      className="flex-shrink-0 w-[280px] sm:w-[320px]"
    >
      <Card className="overflow-hidden p-0 hover:border-primary/50 transition-colors group">
        <div className="flex">
          <button onClick={onGo} className="relative w-24 h-24 flex-shrink-0 overflow-hidden bg-muted">
            {ep.still_path ? (
              <img src={img(ep.still_path, "w300")} alt={ep.name} className="w-full h-full object-cover group-hover:scale-105 transition-transform" loading="lazy" />
            ) : posterPath ? (
              <img src={img(posterPath, "w185")} alt={title} className="w-full h-full object-cover" loading="lazy" />
            ) : (
              <div className="w-full h-full flex items-center justify-center"><Tv className="w-6 h-6 text-muted-foreground" /></div>
            )}
            <span className="absolute top-1 left-1 bg-background/90 backdrop-blur text-[10px] font-bold px-1.5 py-0.5 rounded">
              S{nextEp!.seasonNumber}E{ep.episode_number}
            </span>
          </button>
          <div className="flex-1 p-2.5 flex flex-col min-w-0">
            <p className="text-[10px] text-primary font-bold uppercase tracking-wide line-clamp-1">{title}</p>
            <p className="text-sm font-semibold line-clamp-1 mt-0.5">{ep.name || `Episode ${ep.episode_number}`}</p>
            <p className="text-[10px] text-muted-foreground line-clamp-2 mt-0.5 flex-1">{ep.overview || "No description."}</p>
            <div className="flex items-center gap-1 mt-1">
              <Button size="sm" className="h-7 text-xs flex-1" onClick={markWatched} disabled={episodeToggle.isPending}>
                <Play className="w-3 h-3 mr-1 fill-current" /> Mark watched
              </Button>
              <Button size="sm" variant="outline" className="h-7 w-7 p-0" onClick={onGo} aria-label="Open show">
                <ChevronRight className="w-4 h-4" />
              </Button>
            </div>
          </div>
        </div>
      </Card>
    </motion.div>
  );
}
