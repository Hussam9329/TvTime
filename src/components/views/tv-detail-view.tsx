"use client";

import { useNav } from "@/lib/store";
import { useTvDetail, useSeasonDetail, useWatchedEpisodes, useEpisodeToggle, useWatchlistToggle, useFollowingToggle, useWatchlist, useTrackedShows, useRatingMutate, useMediaUpdate, type EpisodeCompletion } from "@/hooks/use-tmdb";
import { img, imgOrPlaceholder } from "@/lib/tmdb";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { RatingDialog } from "@/components/media/rating-dialog";
import { MediaRow } from "@/components/media/media-row";
import {
  Star, Clock, Calendar, Play, Check, ListPlus, CheckCircle2, Circle, ArrowLeft,
  Tv, Users, Sparkles, Heart, Bell, BellOff, ChevronDown, CheckCheck, Layers, Zap, Trophy,
} from "lucide-react";
import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

export function TvDetailView() {
  const { tvId, back, goPerson } = useNav();
  const detail = useTvDetail(tvId);
  const watchlist = useWatchlist();
  const trackedShows = useTrackedShows();
  const watchlistToggle = useWatchlistToggle();
  const followingToggle = useFollowingToggle();
  const ratingMutate = useRatingMutate();
  const mediaUpdate = useMediaUpdate();

  const [activeTab, setActiveTab] = useState("seasons");
  const [selectedSeason, setSelectedSeason] = useState<number | null>(null);
  const [ratingOpen, setRatingOpen] = useState(false);
  const [lastAutoPromptedShowId, setLastAutoPromptedShowId] = useState<string | null>(null);

  // Derive values needed for effects BEFORE early returns (rules-of-hooks).
  const tData = detail.data;
  const trackedShow = tData ? trackedShows.data?.items.find((w: any) => w.tmdbId === tData.id) : undefined;
  const myRating = trackedShow?.userRating ?? null;
  const isFullyWatched = trackedShow?.watched === true;
  const showTrackingStatus = trackedShow?.status ?? null;
  const tmdbStatus = tData?.status || "";
  const isEnded = /ended|canceled|cancelled/i.test(tmdbStatus);

  const canRateShow = isFullyWatched && isEnded;

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

  // Repair stale local DB states whenever the detail page opens:
  // - Ended + fully watched -> Finished
  // - Ongoing + caught up -> Up To Date, never Finished
  // - Ongoing TV rating -> cleared because whole-show rating is locked until end
  useEffect(() => {
    if (!trackedShow?.id) return;

    if (isFullyWatched && isEnded && showTrackingStatus !== "finished") {
      mediaUpdate.mutateAsync({
        id: trackedShow.id,
        status: "finished",
        watched: true,
      }).catch(() => {});
      return;
    }

    if (isFullyWatched && !isEnded && (showTrackingStatus === "finished" || showTrackingStatus === "watched" || showTrackingStatus !== "uptodate" || myRating != null)) {
      mediaUpdate.mutateAsync({
        id: trackedShow.id,
        status: "uptodate",
        watched: true,
        userRating: null,
      }).catch(() => {});
    }
  }, [trackedShow?.id, isFullyWatched, isEnded, showTrackingStatus, myRating]);

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
  const isFollowing = trackedShows.data?.items.some((w: any) => w.tmdbId === t.id) ?? false;

  // Derive the "effective" tracking label:
  //  - If show is Ended AND user watched all -> "Finished"
  //  - If show is ongoing AND user watched all aired -> "Up To Date"
  //  - Otherwise -> null
  const effectiveLabel: "finished" | "uptodate" | null =
    isFullyWatched ? (isEnded ? "finished" : "uptodate") : null;

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

  const onWatchlist = () => {
    watchlistToggle.mutate({
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
  };

  const onFollow = () => {
    followingToggle.mutate({
      action: isFollowing ? "remove" : "add",
      tmdbId: t.id,
      title: t.name || "",
      posterPath: t.poster_path,
    });
    toast.success(isFollowing ? "Unfollowed" : "Following — track episodes!");
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

  const onRemoveRating = () => {
    ratingMutate.mutate({ action: "remove", mediaType: "tv", tmdbId: t.id });
    toast.success("Rating removed");
  };

  const ratingColor = myRating == null
    ? "text-muted-foreground"
    : myRating >= 80 ? "text-emerald-400"
    : myRating >= 60 ? "text-amber-400"
    : myRating >= 40 ? "text-orange-400"
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
          {/* Action buttons */}
          <div className="flex flex-wrap gap-2">
            <Button variant={isFollowing ? "default" : "secondary"} onClick={onFollow} className="h-10">
              {isFollowing ? <Bell className="w-4 h-4 mr-2" /> : <BellOff className="w-4 h-4 mr-2" />}
              {isFollowing ? "Following" : "Follow"}
            </Button>
            <Button variant={inWatchlist ? "default" : "secondary"} onClick={onWatchlist} className="h-10">
              {inWatchlist ? <Check className="w-4 h-4 mr-2" /> : <ListPlus className="w-4 h-4 mr-2" />}
              {inWatchlist ? "In watchlist" : "Watchlist"}
            </Button>
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
                  {myRating != null ? (
                    <div className="flex items-center gap-2">
                      <div className={`text-4xl font-extrabold ${ratingColor}`}>
                        {myRating}
                        <span className="text-lg text-muted-foreground">/100</span>
                      </div>
                      <div className="w-24 h-2 rounded-full bg-muted overflow-hidden">
                        <div className="h-full bg-amber-400" style={{ width: `${myRating}%` }} />
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
                  {myRating != null ? "Re-rate" : canRateShow ? "Rate out of 100" : "Rating locked"}
                </Button>
              </div>
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
            fullyWatched={isFullyWatched}
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
      />
    </div>
  );
}

function SeasonEpisodes({
  tvId,
  seasons,
  defaultSeason,
  onSelectSeason,
  fullyWatched = false,
  onCompletion,
}: {
  tvId: number;
  seasons: { season_number: number; name: string; episode_count: number; air_date: string | null; poster_path: string | null; overview: string }[];
  defaultSeason: number | null;
  onSelectSeason: (n: number) => void;
  fullyWatched?: boolean;
  onCompletion?: (c: EpisodeCompletion | null | undefined) => void;
}) {
  const [open, setOpen] = useState(false);
  const season = defaultSeason ?? seasons[0]?.season_number ?? 0;
  const seasonData = useSeasonDetail(tvId, season);
  const watched = useWatchedEpisodes(tvId);
  const episodeToggle = useEpisodeToggle();

  const currentSeason = seasons.find((s) => s.season_number === season);
  const watchedSet = new Set(
    (watched.data?.items ?? []).map((e) => `${e.seasonNumber}-${e.episodeNumber}`)
  );

  // If show is fully watched in DB, treat all episodes as watched
  const isEpisodeWatched = (sn: number, en: number) => {
    return fullyWatched || watchedSet.has(`${sn}-${en}`);
  };

  const markAllWatched = async () => {
    if (!seasonData.data?.episodes) return;
    const unwatched = seasonData.data.episodes
      .filter((e) => !isEpisodeWatched(e.season_number, e.episode_number))
      .map((e) => ({ seasonNumber: e.season_number, episodeNumber: e.episode_number, episodeName: e.name }));
    if (unwatched.length === 0) {
      toast.info("All episodes already watched");
      return;
    }
    // Use individual toggles via Promise — capture the last completion result
    try {
      const results = await Promise.all(unwatched.map((e) => episodeToggle.mutateAsync({ action: "add", showId: tvId, ...e })));
      toast.success(`Marked ${unwatched.length} episodes as watched`);
      // The last result's completion reflects the final state of the show
      const lastCompletion = results[results.length - 1]?.completion;
      if (onCompletion) onCompletion(lastCompletion);
    } catch {
      toast.error("Failed to mark episodes");
    }
  };

  const toggleEpisode = async (sn: number, en: number, name: string) => {
    const isWatched = isEpisodeWatched(sn, en);
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

        <Button variant="outline" size="sm" onClick={markAllWatched} disabled={seasonData.isLoading}>
          <CheckCheck className="w-4 h-4 mr-1.5" /> Mark season watched
        </Button>
      </div>

      {/* Progress */}
      {seasonData.data && (
        <div className="flex items-center gap-3 text-sm">
          <div className="flex-1 h-2 rounded-full bg-muted overflow-hidden">
            <div
              className="h-full bg-primary transition-all"
              style={{ width: `${(seasonData.data.episodes.filter((e: any) => isEpisodeWatched(e.season_number, e.episode_number)).length / Math.max(seasonData.data.episodes.length, 1)) * 100}%` }}
            />
          </div>
          <span className="text-muted-foreground whitespace-nowrap">
            {seasonData.data.episodes.filter((e: any) => isEpisodeWatched(e.season_number, e.episode_number)).length} / {seasonData.data.episodes.length} watched
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
            const isWatched = isEpisodeWatched(ep.season_number, ep.episode_number);
            return (
              <motion.div
                key={ep.id}
                initial={{ opacity: 0, x: -8 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: Math.min(idx * 0.02, 0.3) }}
              >
                <Card className={cn(
                  "p-3 flex gap-3 items-start transition-colors",
                  isWatched ? "border-primary/40 bg-primary/5" : "hover:border-border/80"
                )}>
                  <button
                    onClick={() => toggleEpisode(ep.season_number, ep.episode_number, ep.name)}
                    className="flex-shrink-0 mt-0.5"
                    aria-label={isWatched ? "Mark as not watched" : "Mark as watched"}
                  >
                    {isWatched ? (
                      <CheckCircle2 className="w-6 h-6 text-primary" />
                    ) : (
                      <Circle className="w-6 h-6 text-muted-foreground hover:text-primary transition-colors" />
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
                      <h4 className="font-semibold text-sm line-clamp-1">{ep.name || `Episode ${ep.episode_number}`}</h4>
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
                        <Star className="w-3 h-3 fill-amber-400" /> {ep.vote_average.toFixed(1)}
                      </span>
                    )}
                  </div>
                </Card>
              </motion.div>
            );
          })}
        </div>
      )}
    </div>
  );
}
