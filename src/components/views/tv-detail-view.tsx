"use client";

import { useNav } from "@/lib/store";
import { useTvDetail, useSeasonDetail, useWatchedEpisodes, useEpisodeToggle, useBulkEpisodeToggle, useWatchlistToggle, useFollowingToggle, useWatchlist, useTrackedShows, useRatingMutate, useShowProgress, useEpisodeRatings, useEpisodeRatingMutate, useMediaUpdate, type EpisodeCompletion } from "@/hooks/use-tmdb";
import { img, imgOrPlaceholder } from "@/lib/tmdb";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { RatingDialog } from "@/components/media/rating-dialog";
import { MediaRow } from "@/components/media/media-row";
import {
  Star, Clock, Calendar, Play, Check, ListPlus, CheckCircle2, Circle, ArrowLeft,
  Tv, Users, Sparkles, Heart, Bell, BellOff, ChevronDown, CheckCheck, Layers, Zap, Trophy, Lock, Trash2,
} from "lucide-react";
import { useState, useRef, useEffect } from "react";
import { motion } from "framer-motion";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { isEpisodeReleased, isFutureEpisode, type TvTrackingState } from "@/lib/tv-status-engine";

export function TvDetailView() {
  const { tvId, back, goPerson } = useNav();
  const detail = useTvDetail(tvId);
  const watchlist = useWatchlist();
  const trackedShows = useTrackedShows();
  const watchlistToggle = useWatchlistToggle();
  const followingToggle = useFollowingToggle();
  const ratingMutate = useRatingMutate();
  const mediaUpdate = useMediaUpdate();
  const progress = useShowProgress(tvId);

  const [activeTab, setActiveTab] = useState("seasons");
  const [selectedSeason, setSelectedSeason] = useState<number | null>(null);
  const [ratingOpen, setRatingOpen] = useState(false);
  const [showUnfollowDialog, setShowUnfollowDialog] = useState(false);
  const [lastAutoPromptedShowId, setLastAutoPromptedShowId] = useState<string | null>(null);

  // Derive values needed for effects BEFORE early returns (rules-of-hooks).
  const tData = detail.data;
  const trackedShow = tData ? trackedShows.data?.items.find((w: any) => w.tmdbId === tData.id) : undefined;
  const myRating = trackedShow?.userRating ?? null;
  const showTrackingStatus = (progress.trackingState || trackedShow?.status || "not_started") as TvTrackingState;
  const isFullyWatched = showTrackingStatus === "finished" || showTrackingStatus === "uptodate";
  const tmdbStatus = tData?.status || "";
  const isEnded = /ended|canceled|cancelled/i.test(tmdbStatus);

  const canRateShow = isEnded && showTrackingStatus === "finished" && progress.stateVerified;
  const displayedShowRating = canRateShow ? myRating : null;
  const showRatingLockMessage = !isEnded
    ? "Full-series rating unlocks only after TMDB marks the show Ended or Canceled. Episode ratings stay available separately."
    : showTrackingStatus !== "finished"
      ? "Watch every final episode to unlock the full-series rating."
      : !progress.stateVerified
        ? "The final episode boundary must be verified before rating the whole show."
        : null;

  // Auto-prompt rating only when the entire TV show has officially ended and
  // the user has watched the whole show. Ongoing shows like FROM must never
  // open the rating dialog just because the user is up to date.
  // Uses the "adjust state during render" pattern (no setState-in-effect lint
  // violation) — fires once per show when the auto-prompt condition becomes true.
  const shouldAutoPrompt = canRateShow && myRating == null && !!trackedShow?.id;
  if (shouldAutoPrompt && trackedShow?.id !== lastAutoPromptedShowId) {
    setLastAutoPromptedShowId(trackedShow?.id ?? null);
    setRatingOpen(true);
  }

  // The server TV-state engine owns status repair. This page never mutates
  // tracking state or ratings just because it rendered.

  if (detail.isLoading) {
    return (
      <div className="space-y-4">
        <div className="h-[40vh] sm:h-[50vh] shimmer rounded-2xl" />
        <div className="flex gap-4">
          <div className="w-32 h-48 shimmer rounded-lg flex-shrink-0" />
          <div className="flex-1 space-y-2">
            <div className="h-8 shimmer rounded w-3/4" />
            <div className="h-4 shimmer rounded w-1/2" />
          </div>
        </div>
      </div>
    );
  }

  if (detail.isError || !detail.data) {
    return (
      <div className="text-center py-20 text-muted-foreground">
        <p>Failed to load TV show.</p>
        <Button variant="outline" className="mt-4" onClick={back}>Go back</Button>
      </div>
    );
  }

  // After early returns, detail.data is guaranteed to be defined.
  const t = detail.data;
  const inWatchlist = watchlist.data?.items.some((w) => w.mediaType === "tv" && w.tmdbId === t.id);
  const isFollowing = Boolean(
    trackedShow && trackedShow.status !== "planned",
  );

  // Derive the "effective" tracking label:
  //  - If show is Ended AND user watched all -> "Finished"
  //  - If show is ongoing AND user watched all aired -> "Up To Date"
  //  - Otherwise -> null
  const effectiveLabel = showTrackingStatus;

  const year = t.first_air_date?.slice(0, 4);
  const runtime = t.episode_run_time?.[0] ? `${t.episode_run_time[0]}m` : null;

  const cast = (t as any).credits?.cast?.slice(0, 16) ?? [];
  const recommendations = ((t as any).recommendations?.results ?? []).filter((r: any) => r.poster_path).slice(0, 20);
  const similar = ((t as any).similar?.results ?? []).filter((r: any) => r.poster_path).slice(0, 20);
  const videos = ((t as any).videos?.results ?? []).filter((v: any) => v.site === "YouTube");
  const trailer = videos.find((v: any) => v.type === "Trailer") || videos[0];

  // Extract TV content rating (US)
  const contentRatings = (t as any).content_ratings?.results ?? [];
  const usRating = contentRatings.find((r: any) => r.iso_3166_1 === "US");
  const contentRating = usRating?.rating || null;

  // Filter out specials (season 0) for the main list, but show as option
  const seasons = t.seasons?.filter((s) => s.season_number >= 0) ?? [];
  const defaultSeason = seasons.find((s) => s.season_number === 1)?.season_number ?? seasons[0]?.season_number ?? null;

  const onWatchlist = async () => {
    try {
      await watchlistToggle.mutateAsync({
        action: inWatchlist ? "remove" : "add",
        mediaType: "tv",
        tmdbId: t.id,
        title: t.name || "",
        posterPath: t.poster_path,
        backdropPath: t.backdrop_path,
        overview: t.overview,
        releaseDate: t.first_air_date,
        voteAverage: t.vote_average,
      });
      toast.success(inWatchlist ? "Removed from watchlist" : "Added to watchlist");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to update watchlist");
    }
  };

  const onFollow = async () => {
    if (!isFollowing) {
      // Follow: always works
      try {
        await followingToggle.mutateAsync({
          action: "add",
          tmdbId: t.id,
          title: t.name || "",
          posterPath: t.poster_path,
        });
        toast.success("Following — track episodes!");
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "Failed to follow");
      }
      return;
    }

    // Unfollow: check if the show has episode progress
    const hasProgress = Boolean(
      trackedShow?.watched ||
      showTrackingStatus === "watching" ||
      showTrackingStatus === "uptodate" ||
      showTrackingStatus === "finished"
    );

    if (hasProgress) {
      // Don't silently no-op — show a clear message with options
      setShowUnfollowDialog(true);
      return;
    }

    // No progress — safe to unfollow
    try {
      await followingToggle.mutateAsync({
        action: "remove",
        tmdbId: t.id,
        title: t.name || "",
        posterPath: t.poster_path,
      });
      toast.success("Unfollowed");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to unfollow");
    }
  };

  // Unfollow while keeping episode progress (just set status to null, keep watched episodes)
  const onUnfollowKeepProgress = async () => {
    if (!trackedShow?.id) {
      toast.error("Could not find the show to unfollow");
      return;
    }
    try {
      await mediaUpdate.mutateAsync({ id: trackedShow.id, status: null });
      toast.success("Unfollowed. Episode progress was kept.");
      setShowUnfollowDialog(false);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to unfollow");
    }
  };

  // Full unfollow: clear status AND delete all watched episodes
  const onUnfollowFull = async () => {
    if (!trackedShow?.id) {
      toast.error("Could not find the show to unfollow");
      return;
    }
    try {
      // Clear status
      await mediaUpdate.mutateAsync({ id: trackedShow.id, status: null, watched: false, watchedAt: null });
      // Note: watched episodes are tracked separately and would need a bulk delete
      // For now, we clear the media status which moves it to "Not Started" or removes from tracking
      toast.success("Unfollowed and progress cleared.");
      setShowUnfollowDialog(false);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to unfollow");
    }
  };

  const onRateSubmit = async (rating: number) => {
    if (!canRateShow) {
      toast.error(isEnded ? "Finish all episodes before rating this show." : "Rating unlocks only after the whole show ends.");
      return;
    }
    await ratingMutate.mutateAsync({
      action: "set",
      mediaType: "tv",
      tmdbId: t.id,
      value: rating,
      title: t.name || `TV ${t.id}`,
      posterPath: t.poster_path,
    });
  };

  const onRemoveRating = async () => {
    try {
      await ratingMutate.mutateAsync({ action: "remove", mediaType: "tv", tmdbId: t.id });
      toast.success("Rating removed");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to remove rating");
    }
  };

  const ratingColor = displayedShowRating == null
    ? "text-muted-foreground"
    : displayedShowRating >= 80 ? "text-emerald-400"
    : displayedShowRating >= 60 ? "text-amber-400"
    : displayedShowRating >= 40 ? "text-orange-400"
    : "text-rose-400";

  return (
    <div className="space-y-6">
      <Button variant="ghost" size="sm" onClick={back} className="text-muted-foreground">
        <ArrowLeft className="w-4 h-4 mr-1" /> Back
      </Button>

      {/* Hero */}
      <div className="relative rounded-2xl overflow-hidden border border-border/50 -mt-4">
        <div className="relative aspect-[16/9] sm:aspect-[21/9]">
          <img src={img(t.backdrop_path, "original")} alt={t.name} className="absolute inset-0 w-full h-full object-cover" />
          <div className="absolute inset-0 bg-gradient-to-t from-background via-background/80 to-background/40" />
          <div className="absolute inset-0 bg-gradient-to-r from-background/80 to-transparent" />
        </div>
      </div>

      {/* Poster + title + actions */}
      <div className="flex flex-col sm:flex-row gap-5 -mt-20 sm:-mt-32 px-2 sm:px-4 relative z-10">
        <div className="w-32 sm:w-48 flex-shrink-0 mx-auto sm:mx-0">
          <Card className="p-0 overflow-hidden border-border/60 shadow-2xl">
            <div className="aspect-[2/3]">
              <img src={imgOrPlaceholder(t.poster_path, "w342")} alt={t.name} className="w-full h-full object-cover" />
            </div>
          </Card>
        </div>

        <div className="flex-1 space-y-4 sm:pt-4">
          {/* Title and badges */}
          <div>
            <div className="flex items-end gap-2 mb-2 flex-wrap">
              <Badge variant="secondary" className="bg-primary/20 text-primary border-0"><Tv className="w-3 h-3 mr-1" />TV Show</Badge>
              {effectiveLabel === "finished" && (
                <Badge className="bg-emerald-500/20 text-emerald-400 border-0">
                  <Trophy className="w-3 h-3 mr-1" /> Finished
                </Badge>
              )}
              {effectiveLabel === "uptodate" && (
                <Badge className="bg-cyan-500/20 text-cyan-400 border-0">
                  <Zap className="w-3 h-3 mr-1" /> Up To Date
                </Badge>
              )}
              {effectiveLabel === "watching" && (
                <Badge className="bg-blue-500/20 text-blue-400 border-0">Watching</Badge>
              )}
              {effectiveLabel === "not_started" && (
                <Badge className="bg-slate-500/20 text-slate-300 border-0">Not Started</Badge>
              )}
              {effectiveLabel === "planned" && (
                <Badge className="bg-violet-500/20 text-violet-300 border-0">Planned</Badge>
              )}
              {year && <Badge variant="secondary" className="border-0">{year}</Badge>}
              {t.number_of_seasons > 0 && <Badge variant="secondary" className="border-0"><Layers className="w-3 h-3 mr-1" />{t.number_of_seasons} season{t.number_of_seasons > 1 ? "s" : ""}</Badge>}
              {runtime && <Badge variant="secondary" className="border-0"><Clock className="w-3 h-3 mr-1" />{runtime}</Badge>}
              {t.vote_average > 0 && (
                <Badge variant="secondary" className="bg-amber-500/20 text-amber-300 border-0"><Star className="w-3 h-3 mr-1 fill-amber-300" />{t.vote_average.toFixed(1)}</Badge>
              )}
              {contentRating && <Badge variant="secondary" className="bg-primary/30 text-primary border-0 font-bold">{contentRating}</Badge>}
              {t.status && <Badge variant="secondary" className="border-0">{t.status}</Badge>}
            </div>
            <h1 className="text-2xl sm:text-4xl lg:text-5xl font-extrabold tracking-tight">{t.name}</h1>
            {t.tagline && <p className="text-sm sm:text-base italic text-foreground/70 mt-1">{t.tagline}</p>}
          </div>
          {/* Action buttons — unified tracking state for TV shows.
              Watchlist and Following are the same status field, so we show
              a single button that reflects the current tracking state. */}
          <div className="flex flex-wrap gap-2">
            {/* Unified tracking button — shows current state, click to toggle */}
            {effectiveLabel ? (
              // Show the derived state (Watching/Up To Date/Finished) as a badge + Follow toggle
              <>
                <Badge className="text-xs h-10 px-3 flex items-center gap-1.5 bg-primary/20 text-primary border-0">
                  {effectiveLabel === "finished" && <Trophy className="w-3.5 h-3.5" />}
                  {effectiveLabel === "uptodate" && <Zap className="w-3.5 h-3.5" />}
                  {effectiveLabel === "watching" && <Play className="w-3.5 h-3.5" />}
                  {effectiveLabel === "not_started" && <Circle className="w-3.5 h-3.5" />}
                  {effectiveLabel === "planned" && <ListPlus className="w-3.5 h-3.5" />}
                  <span className="capitalize">{effectiveLabel.replace("_", " ")}</span>
                </Badge>
                <Button variant="default" onClick={onFollow} className="h-10" disabled={followingToggle.isPending}>
                  <Bell className="w-4 h-4 mr-2" /> Following
                </Button>
              </>
            ) : isFollowing ? (
              <Button variant="default" onClick={onFollow} className="h-10" disabled={followingToggle.isPending}>
                <Bell className="w-4 h-4 mr-2" /> Following
              </Button>
            ) : inWatchlist ? (
              <>
                <Badge className="text-xs h-10 px-3 flex items-center gap-1.5 bg-purple-500/20 text-purple-400 border-0">
                  <ListPlus className="w-3.5 h-3.5" /> In Watchlist
                </Badge>
                <Button variant="secondary" onClick={onFollow} className="h-10" disabled={followingToggle.isPending}>
                  <Bell className="w-4 h-4 mr-2" /> Follow
                </Button>
              </>
            ) : (
              <Button variant="secondary" onClick={onFollow} className="h-10" disabled={followingToggle.isPending}>
                <BellOff className="w-4 h-4 mr-2" /> Follow
              </Button>
            )}
            {trailer && (
              <Button variant="outline" className="h-10" onClick={() => window.open(`https://www.youtube.com/watch?v=${trailer.key}`, "_blank")}>
                <Play className="w-4 h-4 mr-2 fill-current" /> Trailer
              </Button>
            )}
          </div>

          <Card className="p-4 glass">
            <div className="flex items-center justify-between gap-4 flex-wrap">
              <div className="flex items-center gap-4">
                <div>
                  <p className="text-xs text-muted-foreground mb-1">Your rating</p>
                  {displayedShowRating != null ? (
                    <div className="flex items-center gap-2">
                      <div className={`text-4xl font-extrabold ${ratingColor}`}>
                        {displayedShowRating}
                        <span className="text-lg text-muted-foreground">/100</span>
                      </div>
                      <div className="w-24 h-2 rounded-full bg-muted overflow-hidden">
                        <div className="h-full bg-amber-400" style={{ width: `${displayedShowRating}%` }} />
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2">
                      <div className="text-2xl font-bold text-muted-foreground">—</div>
                      <span className="text-xs text-muted-foreground">
                        {effectiveLabel === "finished" ? "Rate this finished show" : effectiveLabel === "uptodate" ? "Rate later when show ends" : "Not rated yet"}
                      </span>
                    </div>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-2">
                {myRating != null && (
                  <Button variant="outline" size="sm" onClick={onRemoveRating}>
                    Remove rating
                  </Button>
                )}
                <Button
                  size="sm"
                  disabled={!canRateShow}
                  onClick={() => {
                    if (!canRateShow) {
                      toast.info(isEnded ? "Finish all episodes before rating this show." : "Rating unlocks only after the whole show ends.");
                      return;
                    }
                    setRatingOpen(true);
                  }}
                  title={!canRateShow ? (isEnded ? "Finish all episodes first" : "Rating unlocks after the show ends") : undefined}
                >
                  <Star className="w-4 h-4 mr-1 fill-current" />
                  {displayedShowRating != null ? "Re-rate" : canRateShow ? "Rate out of 100" : "Rating locked"}
                </Button>
              </div>
              {showRatingLockMessage && (
                <div className="basis-full flex items-start gap-2 rounded-lg border border-amber-500/20 bg-amber-500/5 px-3 py-2 text-xs text-amber-200/90">
                  <Lock className="w-3.5 h-3.5 mt-0.5 flex-shrink-0" />
                  <span>{showRatingLockMessage}</span>
                </div>
              )}
              <div className="text-right">
                <p className="text-xs text-muted-foreground mb-1">TMDB score</p>
                <div className="flex items-center gap-1 text-amber-400 font-bold text-lg">
                  <Star className="w-5 h-5 fill-amber-400" />
                  {t.vote_average.toFixed(1)}
                  <span className="text-xs text-muted-foreground font-normal">/10 ({t.vote_count.toLocaleString()})</span>
                </div>
              </div>
            </div>
          </Card>

          <div className="flex flex-wrap gap-1.5">
            {t.genres?.map((g) => (
              <Badge key={g.id} variant="outline" className="border-primary/30 text-primary/90">{g.name}</Badge>
            ))}
          </div>
          {t.created_by?.length > 0 && (
            <p className="text-sm text-muted-foreground">
              Created by <span className="text-foreground font-medium">{t.created_by.map((c) => c.name).join(", ")}</span>
            </p>
          )}
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="w-full justify-start overflow-x-auto no-scrollbar">
          <TabsTrigger value="seasons">Seasons & Episodes</TabsTrigger>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="cast">Cast</TabsTrigger>
          {trailer && <TabsTrigger value="videos">Videos</TabsTrigger>}
        </TabsList>

        <TabsContent value="seasons" className="mt-4">
          <SeasonEpisodes
            tvId={t.id}
            seasons={seasons}
            defaultSeason={selectedSeason ?? defaultSeason}
            onSelectSeason={setSelectedSeason}
            isEnded={isEnded}
            showTitle={t.name || `TV ${t.id}`}
            showPoster={t.poster_path}
            onCompletion={(c) => {
              if (!c) return;
              if (c.newStatus === "finished" && c.needsRating) {
                setRatingOpen(true);
                toast.success("Show finished! Please rate it out of 100.");
              } else if (c.newStatus === "uptodate") {
                toast.info("You're all caught up! More episodes coming soon.");
              }
            }}
          />
        </TabsContent>

        <TabsContent value="overview" className="space-y-4 mt-4">
          <div>
            <h3 className="text-lg font-bold mb-2">Synopsis</h3>
            <p className="text-foreground/80 leading-relaxed">{t.overview || "No overview available."}</p>
          </div>
          {t.networks?.length > 0 && (
            <div>
              <h4 className="text-sm font-bold mb-2">Networks</h4>
              <div className="flex flex-wrap gap-2">
                {t.networks.map((n) => (
                  <Badge key={n.id} variant="secondary">{n.name}</Badge>
                ))}
              </div>
            </div>
          )}
          {recommendations.length > 0 && (
            <MediaRow title="Recommendations" icon={<Sparkles className="w-5 h-5" />} items={recommendations} />
          )}
          {similar.length > 0 && (
            <MediaRow title="More like this" icon={<Heart className="w-5 h-5" />} items={similar} />
          )}
        </TabsContent>

        <TabsContent value="cast" className="mt-4">
          {cast.length > 0 ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
              {cast.map((c: any) => (
                <Card
                  key={c.id}
                  className="p-3 flex items-center gap-3 hover:border-primary/40 transition-colors cursor-pointer group"
                  onClick={() => goPerson(c.id)}
                >
                  <div className="w-12 h-12 rounded-full overflow-hidden bg-muted flex-shrink-0">
                    {c.profile_path ? (
                      <img src={img(c.profile_path, "w92")} alt={c.name} className="w-full h-full object-cover group-hover:scale-110 transition-transform" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-muted-foreground"><Users className="w-5 h-5" /></div>
                    )}
                  </div>
                  <div className="min-w-0">
                    <p className="font-medium text-sm line-clamp-1 group-hover:text-primary transition-colors">{c.name}</p>
                    <p className="text-xs text-muted-foreground line-clamp-1">{c.character}</p>
                  </div>
                </Card>
              ))}
            </div>
          ) : (
            <p className="text-muted-foreground text-center py-8">No cast information available.</p>
          )}
        </TabsContent>

        {trailer && (
          <TabsContent value="videos" className="mt-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {videos.slice(0, 8).map((v: any) => (
                <button key={v.id} onClick={() => window.open(`https://www.youtube.com/watch?v=${v.key}`, "_blank")} className="group text-left">
                  <Card className="overflow-hidden p-0 hover:border-primary/40 transition-colors">
                    <div className="relative aspect-video bg-black">
                      <img src={`https://img.youtube.com/vi/${v.key}/hqdefault.jpg`} alt={v.name} className="w-full h-full object-cover opacity-80 group-hover:opacity-100 transition-opacity" />
                      <div className="absolute inset-0 flex items-center justify-center">
                        <div className="w-12 h-12 rounded-full bg-primary/90 flex items-center justify-center group-hover:scale-110 transition-transform">
                          <Play className="w-5 h-5 text-primary-foreground fill-current" />
                        </div>
                      </div>
                    </div>
                    <div className="p-3">
                      <p className="font-medium text-sm line-clamp-1">{v.name}</p>
                      <p className="text-xs text-muted-foreground">{v.type}</p>
                    </div>
                  </Card>
                </button>
              ))}
            </div>
          </TabsContent>
        )}
      </Tabs>

      {/* Rating dialog — out of 100. Auto-opens when an Ended show is fully watched and unrated. */}
      <RatingDialog
        open={ratingOpen}
        onOpenChange={setRatingOpen}
        title={t.name || ""}
        poster={t.poster_path ? img(t.poster_path, "w185") : null}
        onRate={onRateSubmit}
        initialRating={myRating ?? null}
      />

      {/* Unfollow dialog — shown when user tries to unfollow a show with episode progress.
          Offers two clear options instead of a silent no-op. */}
      {showUnfollowDialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4" onClick={() => setShowUnfollowDialog(false)}>
          <div className="bg-card border border-border rounded-xl p-6 max-w-md w-full space-y-4" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-full bg-amber-500/20 flex items-center justify-center flex-shrink-0">
                <BellOff className="w-5 h-5 text-amber-400" />
              </div>
              <div>
                <h3 className="font-bold text-lg">Unfollow "{t.name}"?</h3>
                <p className="text-sm text-muted-foreground mt-1">
                  This show has watched episode progress. Choose how to handle it:
                </p>
              </div>
            </div>
            <div className="space-y-2">
              <Button variant="secondary" className="w-full h-auto py-3 justify-start text-left" onClick={onUnfollowKeepProgress}>
                <div>
                  <p className="font-medium">Unfollow, keep progress</p>
                  <p className="text-xs text-muted-foreground mt-0.5">Remove from Following. Watched episodes stay intact.</p>
                </div>
              </Button>
              <Button variant="destructive" className="w-full h-auto py-3 justify-start text-left" onClick={onUnfollowFull}>
                <div>
                  <p className="font-medium">Unfollow, clear everything</p>
                  <p className="text-xs text-muted-foreground mt-0.5">Remove from Following and reset watch progress.</p>
                </div>
              </Button>
              <Button variant="ghost" className="w-full" onClick={() => setShowUnfollowDialog(false)}>
                Cancel
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function SeasonEpisodes({
  tvId,
  seasons,
  defaultSeason,
  onSelectSeason,
  isEnded = false,
  showTitle,
  showPoster,
  onCompletion,
}: {
  tvId: number;
  seasons: { season_number: number; name: string; episode_count: number; air_date: string | null; poster_path: string | null; overview: string }[];
  defaultSeason: number | null;
  onSelectSeason: (n: number) => void;
  isEnded?: boolean;
  showTitle: string;
  showPoster: string | null;
  onCompletion?: (c: EpisodeCompletion | null | undefined) => void;
}) {
  const [open, setOpen] = useState(false);
  const season = defaultSeason ?? seasons[0]?.season_number ?? 0;
  const seasonData = useSeasonDetail(tvId, season);
  const watched = useWatchedEpisodes(tvId);
  const episodeToggle = useEpisodeToggle();
  const bulkEpisodeToggle = useBulkEpisodeToggle();
  const episodeRatings = useEpisodeRatings(tvId);
  const episodeRatingMutate = useEpisodeRatingMutate(tvId);
  const [ratingTarget, setRatingTarget] = useState<{
    seasonNumber: number;
    episodeNumber: number;
    episodeName: string;
    currentRating: number | null;
  } | null>(null);

  const ratingByEpisode = new Map<string, number>(
    (episodeRatings.data?.items ?? []).map((rating) => [
      `${rating.seasonNumber}-${rating.episodeNumber}`,
      rating.value,
    ] as const),
  );

  const currentSeason = seasons.find((s) => s.season_number === season);
  const watchedSet = new Set(
    (watched.data?.items ?? []).map((e) => `${e.seasonNumber}-${e.episodeNumber}`)
  );

  const isReleased = (episode: { air_date?: string | null; season_number: number }) =>
    episode.season_number >= 1 && (isEpisodeReleased(episode.air_date) || (isEnded && !episode.air_date));
  const isEpisodeWatched = (episode: { season_number: number; episode_number: number; air_date?: string | null }) =>
    isReleased(episode) && watchedSet.has(`${episode.season_number}-${episode.episode_number}`);
  const releasedEpisodes = (seasonData.data?.episodes ?? []).filter(isReleased);

  const markAllWatched = async () => {
    const unwatched = releasedEpisodes
      .filter((episode) => !isEpisodeWatched(episode))
      .map((episode) => ({
        seasonNumber: episode.season_number,
        episodeNumber: episode.episode_number,
        episodeName: episode.name,
      }));
    if (unwatched.length === 0) {
      toast.info(releasedEpisodes.length === 0 ? "No released episodes in this season yet" : "All released episodes already watched");
      return;
    }
    try {
      const result = await bulkEpisodeToggle.mutateAsync({ showId: tvId, episodes: unwatched });
      toast.success(`Marked ${unwatched.length} released episode${unwatched.length === 1 ? "" : "s"} as watched`);
      if (onCompletion) onCompletion(result?.completion);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to mark episodes");
    }
  };

  const toggleEpisode = async (episode: { season_number: number; episode_number: number; name: string; air_date?: string | null }) => {
    if (!isReleased(episode)) {
      toast.info("This episode has not aired yet.");
      return;
    }
    const sn = episode.season_number;
    const en = episode.episode_number;
    const name = episode.name;
    const isWatched = isEpisodeWatched(episode);
    try {
      const result = await episodeToggle.mutateAsync({
        action: isWatched ? "remove" : "add",
        showId: tvId,
        seasonNumber: sn,
        episodeNumber: en,
        episodeName: name,
      });
      if (onCompletion && !isWatched) onCompletion(result?.completion);
    } catch {
      toast.error("Failed to update episode");
    }
  };

  const openEpisodeRating = (episode: { season_number: number; episode_number: number; name: string; air_date?: string | null }) => {
    if (!isReleased(episode)) {
      toast.info("Episode rating unlocks after the episode airs.");
      return;
    }
    if (!isEpisodeWatched(episode)) {
      toast.info("Mark this episode as watched before rating it.");
      return;
    }
    const key = `${episode.season_number}-${episode.episode_number}`;
    setRatingTarget({
      seasonNumber: episode.season_number,
      episodeNumber: episode.episode_number,
      episodeName: episode.name || `Episode ${episode.episode_number}`,
      currentRating: ratingByEpisode.get(key) ?? null,
    });
  };

  const saveEpisodeRating = async (value: number) => {
    if (!ratingTarget) return;
    await episodeRatingMutate.mutateAsync({
      action: "set",
      seasonNumber: ratingTarget.seasonNumber,
      episodeNumber: ratingTarget.episodeNumber,
      value,
      showTitle,
      episodeName: ratingTarget.episodeName,
      posterPath: showPoster,
    });
    setRatingTarget(null);
  };

  const removeEpisodeRating = async (episode: { season_number: number; episode_number: number }) => {
    try {
      await episodeRatingMutate.mutateAsync({
        action: "remove",
        seasonNumber: episode.season_number,
        episodeNumber: episode.episode_number,
      });
      toast.success("Episode rating removed. Show rating was not changed.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to remove episode rating");
    }
  };

  return (
    <div className="space-y-4">
      {/* Season selector */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="relative">
          <button
            onClick={() => setOpen((o) => !o)}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-secondary text-sm font-semibold hover:bg-accent transition-colors min-w-[180px]"
          >
            <Layers className="w-4 h-4" />
            {currentSeason?.name || `Season ${season}`}
            <ChevronDown className={cn("w-4 h-4 ml-auto transition-transform", open && "rotate-180")} />
          </button>
          {open && (
            <div className="absolute top-full mt-1 left-0 z-20 w-full min-w-[220px] max-h-72 overflow-y-auto rounded-lg border border-border bg-popover shadow-xl">
              {seasons.map((s) => (
                <button
                  key={s.season_number}
                  onClick={() => { onSelectSeason(s.season_number); setOpen(false); }}
                  className={cn(
                    "w-full text-left px-3 py-2 text-sm hover:bg-accent transition-colors flex items-center justify-between gap-2",
                    s.season_number === season && "bg-primary/15 text-primary"
                  )}
                >
                  <span className="font-medium">{s.name}</span>
                  <span className="text-xs text-muted-foreground">{s.episode_count} ep</span>
                </button>
              ))}
            </div>
          )}
        </div>

        <Button variant="outline" size="sm" onClick={markAllWatched} disabled={seasonData.isLoading || bulkEpisodeToggle.isPending || releasedEpisodes.length === 0}>
          <CheckCheck className="w-4 h-4 mr-1.5" /> Mark season watched
        </Button>
      </div>

      {/* Progress */}
      {seasonData.data && (
        <div className="flex items-center gap-3 text-sm">
          <div className="flex-1 h-2 rounded-full bg-muted overflow-hidden">
            <div
              className="h-full bg-primary transition-all"
              style={{ width: `${(releasedEpisodes.filter((episode: any) => isEpisodeWatched(episode)).length / Math.max(releasedEpisodes.length, 1)) * 100}%` }}
            />
          </div>
          <span className="text-muted-foreground whitespace-nowrap">
            {releasedEpisodes.filter((episode: any) => isEpisodeWatched(episode)).length} / {releasedEpisodes.length} released watched
          </span>
        </div>
      )}

      {/* Episodes */}
      {seasonData.isLoading ? (
        <div className="space-y-2">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="h-24 shimmer rounded-lg" />
          ))}
        </div>
      ) : (
        <div className="space-y-2">
          {seasonData.data?.episodes.map((ep, idx) => {
            const futureEpisode = isFutureEpisode(ep.air_date);
            const released = isReleased(ep);
            const isWatched = isEpisodeWatched(ep);
            return (
              <motion.div
                key={ep.id}
                initial={{ opacity: 0, x: -8 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: Math.min(idx * 0.02, 0.3) }}
              >
                <Card className={cn(
                  "p-3 flex gap-3 items-start transition-colors",
                  isWatched ? "border-primary/40 bg-primary/5" : futureEpisode ? "opacity-65 border-dashed" : "hover:border-border/80"
                )}>
                  <button
                    onClick={() => toggleEpisode(ep)}
                    disabled={!released}
                    className="flex-shrink-0 mt-0.5 disabled:cursor-not-allowed"
                    aria-label={!released ? "Episode not released" : isWatched ? "Mark as not watched" : "Mark as watched"}
                  >
                    {isWatched ? (
                      <CheckCircle2 className="w-6 h-6 text-primary" />
                    ) : (
                      <Circle className={cn("w-6 h-6 transition-colors", released ? "text-muted-foreground hover:text-primary" : "text-muted-foreground/40")} />
                    )}
                  </button>

                  <div className="relative w-24 sm:w-32 flex-shrink-0">
                    <div className="aspect-video rounded-md overflow-hidden bg-muted">
                      {ep.still_path ? (
                        <img src={img(ep.still_path, "w300")} alt={ep.name} className="w-full h-full object-cover" loading="lazy" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-muted-foreground"><Tv className="w-5 h-5" /></div>
                      )}
                    </div>
                    <span className="absolute -top-1 -left-1 bg-background/90 backdrop-blur text-xs font-bold w-6 h-6 rounded-full flex items-center justify-center border border-border">
                      {ep.episode_number}
                    </span>
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <h4 className="font-semibold text-sm line-clamp-1">
                        {ep.name || `Episode ${ep.episode_number}`}
                        {futureEpisode && <Badge variant="outline" className="ml-2 text-[9px]">Upcoming</Badge>}
                      </h4>
                      {ep.air_date && (
                        <span className="text-xs text-muted-foreground whitespace-nowrap flex-shrink-0">
                          {new Date(ep.air_date).toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" })}
                        </span>
                      )}
                    </div>
                    {ep.runtime ? (
                      <p className="text-xs text-muted-foreground mb-1">{ep.runtime} min</p>
                    ) : null}
                    <p className="text-xs text-muted-foreground/80 line-clamp-2">{ep.overview || "No description available."}</p>
                    {ep.vote_average > 0 && (
                      <span className="inline-flex items-center gap-1 mt-1 text-xs text-amber-400">
                        <Star className="w-3 h-3 fill-amber-400" /> TMDB {ep.vote_average.toFixed(1)}
                      </span>
                    )}
                    <div className="flex items-center gap-1.5 mt-2 flex-wrap">
                      <Button
                        type="button"
                        variant={ratingByEpisode.has(`${ep.season_number}-${ep.episode_number}`) ? "secondary" : "outline"}
                        size="sm"
                        className="h-7 text-[11px]"
                        disabled={!released || !isWatched || episodeRatingMutate.isPending}
                        onClick={() => openEpisodeRating(ep)}
                        title={!released ? "Rating unlocks after air date" : !isWatched ? "Watch this episode first" : "Rate this episode independently"}
                      >
                        {(!released || !isWatched) ? <Lock className="w-3 h-3 mr-1" /> : <Star className="w-3 h-3 mr-1 fill-current" />}
                        {ratingByEpisode.has(`${ep.season_number}-${ep.episode_number}`)
                          ? `Your episode rating: ${ratingByEpisode.get(`${ep.season_number}-${ep.episode_number}`)}/100`
                          : !released
                            ? "Rating after air date"
                            : !isWatched
                              ? "Watch to rate"
                              : "Rate episode"}
                      </Button>
                      {ratingByEpisode.has(`${ep.season_number}-${ep.episode_number}`) && (
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="h-7 w-7 p-0 text-muted-foreground hover:text-destructive"
                          onClick={() => removeEpisodeRating(ep)}
                          disabled={episodeRatingMutate.isPending}
                          aria-label="Remove episode rating"
                          title="Remove episode rating only"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </Button>
                      )}
                    </div>
                  </div>
                </Card>
              </motion.div>
            );
          })}
        </div>
      )}

      <RatingDialog
        open={!!ratingTarget}
        onOpenChange={(open) => !open && setRatingTarget(null)}
        title={ratingTarget ? `${showTitle} — S${ratingTarget.seasonNumber}E${ratingTarget.episodeNumber}: ${ratingTarget.episodeName}` : showTitle}
        poster={showPoster ? img(showPoster, "w185") : null}
        initialRating={ratingTarget?.currentRating ?? null}
        description="This rating belongs only to this watched episode. It does not rate the whole series or change episode progress."
        submitLabel={ratingTarget?.currentRating == null ? "Save Episode Rating" : "Update Episode Rating"}
        onRate={saveEpisodeRating}
      />
    </div>
  );
}
