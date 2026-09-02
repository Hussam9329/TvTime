"use client";

import { useNav } from "@/lib/store";
import { useTvDetail, useSeasonDetail, useWatchedEpisodes, useEpisodeToggle, useBulkEpisodeToggle, useWatchlistToggle, useFollowingToggle, useMediaState, useRatingMutate, useShowProgress, useEpisodeRatings, useEpisodeRatingMutate, type EpisodeCompletion } from "@/hooks/use-tmdb";
import { getTitle, img, imgOrPlaceholder, type MediaItem } from "@/lib/tmdb";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { RatingDialog } from "@/components/media/rating-dialog";
import { EpisodeWatchConfirmationDialog } from "@/components/media/episode-watch-confirmation-dialog";
import { MediaRow } from "@/components/media/media-row";
import { SafeImage } from "@/components/media/safe-image";
import { OfficialPosterPicker } from "@/components/media/official-poster-picker";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import {
  Star, Clock, Play, ListPlus, Check, CheckCircle2, Circle, ArrowLeft,
  Tv, Users, Sparkles, Heart, Bell, BellOff, ChevronDown, CheckCheck, Layers, Zap, Trophy, Lock, Trash2, RotateCcw, ExternalLink, CircleStop,
} from "lucide-react";
import { useState } from "react";
import { motion } from "framer-motion";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { isEpisodeReleased, isFutureEpisode, type TvTrackingState } from "@/lib/tv-status-engine";
import {
  buildEpisodeWatchPlan,
  buildSeasonWatchPlan,
  progressEpisodesToWatchRefs,
  type EpisodeWatchPlan,
  type WatchEpisodeRef,
} from "@/lib/episode-watch-plan";
import { detectIsArabic } from "@/lib/arabic-media";
import {
  filterAndPrioritizeMediaCollectionWorldItems,
  mediaCollectionWorldForItem,
} from "@/lib/media-world-pipeline";
import { useWatchUndo } from "@/hooks/use-watch-undo";

export function TvDetailView() {
  const { tvId, back, goPerson } = useNav();
  const mediaState = useMediaState(tvId, "tv");
  const detail = useTvDetail(tvId, mediaState.data?.isArabic ? "ar" : undefined);
  const watchlistToggle = useWatchlistToggle();
  const followingToggle = useFollowingToggle();
  const ratingMutate = useRatingMutate();
  const progress = useShowProgress(tvId);

  const [activeTab, setActiveTab] = useState("seasons");
  const [selectedSeason, setSelectedSeason] = useState<number | null>(null);
  const [ratingOpen, setRatingOpen] = useState(false);
  const [pendingCompletionRating, setPendingCompletionRating] = useState(false);
  const [showUnfollowDialog, setShowUnfollowDialog] = useState(false);
  const [showStopDialog, setShowStopDialog] = useState(false);
  const [lastAutoPromptedShowId, setLastAutoPromptedShowId] = useState<string | null>(null);

  // Derive values needed for effects BEFORE early returns (rules-of-hooks).
  const tData = detail.data;
  const trackedShow = mediaState.data ?? progress.mediaItem ?? undefined;
  const myRating = trackedShow?.userRating ?? null;
  // Fix #2: Don't default to "not_started" — use null if show is not tracked
  const showTrackingStatus = (progress.trackingState || trackedShow?.status || null) as TvTrackingState | null;
  const tmdbStatus = tData?.status || "";
  const isEnded = /ended|canceled|cancelled/i.test(tmdbStatus);
  const ratingPromptIdentity = tData?.id ? String(tData.id) : null;

  const hasWatchedEveryFinalEpisode = progress.stateVerified
    && progress.totalEpisodes > 0
    && progress.watchedCount >= progress.totalEpisodes;
  const canRateShow = isEnded && (hasWatchedEveryFinalEpisode || pendingCompletionRating);
  const displayedShowRating = showTrackingStatus === "finished" ? myRating : null;
  const showRatingLockMessage = !isEnded
    ? "Full-series rating unlocks only after TMDB marks the show Ended or Canceled. Episode ratings stay available separately."
    : !progress.stateVerified
      ? "The final episode boundary must be verified before rating the whole show."
      : !hasWatchedEveryFinalEpisode
        ? "Watch every final episode to unlock the full-series rating."
        : null;

  // Auto-prompt rating only when the entire TV show has officially ended and
  // the user has watched the whole show. Ongoing shows like FROM must never
  // open the rating dialog just because the user is up to date.
  // Uses the "adjust state during render" pattern (no setState-in-effect lint
  // violation) — fires once per show when the auto-prompt condition becomes true.
  const shouldAutoPrompt = canRateShow && myRating == null && !!ratingPromptIdentity;
  if (shouldAutoPrompt && ratingPromptIdentity !== lastAutoPromptedShowId) {
    setLastAutoPromptedShowId(ratingPromptIdentity);
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
  const displayTitle = getTitle(t);
  const inWatchlist = Boolean(mediaState.data?.status === "planned");
  // Following membership and episode progress are separate concepts. A show
  // can retain a Watching/Up To Date progress badge while isFollowing is false.
  const isFollowing = progress.isFollowing;
  const effectiveLabel = showTrackingStatus;
  const isStopped = showTrackingStatus === "stopped";
  const hasSavedProgress = progress.watchedItems.length > 0
    || trackedShow?.watched === true
    || ["watching", "uptodate", "finished", "stopped"].includes(String(showTrackingStatus || ""));

  const year = t.first_air_date?.slice(0, 4);
  const runtime = t.episode_run_time?.[0] ? `${t.episode_run_time[0]}m` : null;
  const genreNames = (t.genres ?? []).map((genre) => genre.name);
  const isArabicShow = detectIsArabic({ originalLanguage: t.original_language, originCountry: t.origin_country });
  const collectionWorld = mediaCollectionWorldForItem({
    type: "series",
    title: displayTitle,
    originalLanguage: t.original_language,
    originCountries: t.origin_country,
    genres: genreNames,
    classificationComplete: true,
  }, "tv");
  const filmweenSearchTitle = isArabicShow ? ((t as any).english_name || displayTitle) : displayTitle;
  const voduSearchTitle = displayTitle;
  const cinemanaSearchTitle = displayTitle;

  const cast = (t as any).credits?.cast?.slice(0, 16) ?? [];
  const recommendationCandidates = (((t as any).recommendations?.results ?? []) as MediaItem[])
    .filter((result: any) => result.poster_path);
  const similarCandidates = (((t as any).similar?.results ?? []) as MediaItem[])
    .filter((result: any) => result.poster_path);
  const recommendations = filterAndPrioritizeMediaCollectionWorldItems(
    recommendationCandidates,
    collectionWorld,
  )
    .slice(0, 20);
  const similar = filterAndPrioritizeMediaCollectionWorldItems(
    similarCandidates,
    collectionWorld,
  )
    .slice(0, 20);
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
        title: displayTitle,
        posterPath: t.poster_path,
        backdropPath: t.backdrop_path,
        overview: t.overview,
        releaseDate: t.first_air_date,
        voteAverage: t.vote_average,
        genres: t.genres.map((genre) => genre.name),
        originCountry: t.origin_country,
        originalLanguage: t.original_language,
        seasons: t.number_of_seasons,
        episodes: t.number_of_episodes,
      });
      toast.success(inWatchlist ? "Removed from watchlist" : "Added to watchlist");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to update watchlist");
    }
  };

  const onFollow = async () => {
    if (!isFollowing) {
      try {
        const result = await followingToggle.mutateAsync({
          action: "add",
          tmdbId: t.id,
          title: displayTitle,
          posterPath: t.poster_path,
          releaseDate: t.first_air_date,
          overview: t.overview,
          voteAverage: t.vote_average,
          genres: t.genres.map((genre) => genre.name),
          originCountry: t.origin_country,
          originalLanguage: t.original_language,
          seasons: t.number_of_seasons,
          episodes: t.number_of_episodes,
        });
        if (result.changed) toast.success(isStopped ? "Watching resumed — the next episode is active again." : "Following — track episodes!");
        else toast.info("This show is already followed.");
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "Failed to follow");
      }
      return;
    }

    if (hasSavedProgress) {
      setShowUnfollowDialog(true);
      return;
    }

    try {
      const result = await followingToggle.mutateAsync({
        action: "remove",
        tmdbId: t.id,
        title: displayTitle,
        keepProgress: true,
      });
      if (result.changed) toast.success("Unfollowed");
      else toast.info("This show was already unfollowed.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to unfollow");
    }
  };

  const onStopWatching = async () => {
    try {
      const result = await followingToggle.mutateAsync({
        action: "remove",
        tmdbId: t.id,
        title: displayTitle,
        keepProgress: true,
        stopWatching: true,
      });
      if (result.changed) toast.success("Stopped watching. Your episode progress was kept.");
      else toast.info("This show is already stopped.");
      setShowStopDialog(false);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to stop watching");
    }
  };

  const onUnfollowKeepProgress = async () => {
    try {
      const result = await followingToggle.mutateAsync({
        action: "remove",
        tmdbId: t.id,
        title: displayTitle,
        keepProgress: true,
      });
      if (result.changed) toast.success("Unfollowed. Episode progress was kept.");
      else toast.info("This show was already unfollowed. Progress is unchanged.");
      setShowUnfollowDialog(false);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to unfollow");
    }
  };

  const onUnfollowFull = async () => {
    try {
      const result = await followingToggle.mutateAsync({
        action: "remove",
        tmdbId: t.id,
        title: displayTitle,
        keepProgress: false,
      });
      if (result.changed) {
        toast.success(`Unfollowed. ${result.deletedEpisodes || 0} watched episodes and ${result.deletedRatings || 0} episode ratings cleared.`);
      } else {
        toast.info("This show was already unfollowed with no saved progress.");
      }
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
      title: displayTitle,
      posterPath: t.poster_path,
      releaseDate: t.first_air_date,
      overview: t.overview,
      voteAverage: t.vote_average,
      genres: t.genres.map((genre) => genre.name),
      originCountry: t.origin_country,
      originalLanguage: t.original_language,
      seasons: t.number_of_seasons,
      episodes: t.number_of_episodes,
    });
    setLastAutoPromptedShowId(String(t.id));
    setPendingCompletionRating(false);
  };

  const onRemoveRating = async () => {
    try {
      await ratingMutate.mutateAsync({ action: "remove", mediaType: "tv", tmdbId: t.id });
      setLastAutoPromptedShowId(String(t.id));
      setRatingOpen(false);
      toast.success("Rating removed and Finished status cleared");
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
    <div className="tvtime-tv-detail-page space-y-5">
      <Button variant="ghost" size="sm" onClick={back} className="tvtime-tv-detail-back-button text-muted-foreground">
        <ArrowLeft className="w-4 h-4 mr-1" /> {isArabicShow ? "رجوع" : "Back"}
      </Button>

      <section className="tvtime-tv-detail-hero relative isolate overflow-hidden rounded-[28px] border border-white/15 bg-[#07101f] shadow-[0_30px_90px_rgba(0,0,0,0.45)]">
      {/* Hero */}
      <div data-ui-surface="hero" className="absolute inset-0 -z-20 overflow-hidden">
        <div className="absolute inset-0">
          <SafeImage src={img(t.backdrop_path, "w1280")} alt={displayTitle} fill variant="backdrop" priority className="absolute inset-0" />
          <div className="absolute inset-0 bg-[linear-gradient(90deg,rgba(3,9,19,0.84)_0%,rgba(4,12,25,0.7)_45%,rgba(3,8,18,0.54)_100%)]" />
          <div className="absolute inset-0 bg-gradient-to-t from-[#050b16]/95 via-[#07101f]/35 to-[#07101f]/35" />
        </div>
      </div>

      {/* Poster + title + actions */}
      <div className="tvtime-tv-detail-hero__layout relative z-10 grid grid-cols-1 gap-6 p-5 sm:p-7 md:grid-cols-[220px_minmax(0,1fr)] md:gap-8 lg:grid-cols-[270px_minmax(0,1fr)] lg:p-10">
        <div className="tvtime-tv-detail-hero__poster w-36 flex-shrink-0 mx-auto sm:w-52 md:w-full md:mx-0">
          <Card className="p-0 overflow-hidden rounded-[22px] border-white/25 bg-black/30 shadow-[0_24px_55px_rgba(0,0,0,0.5)]">
            <div className="relative aspect-[2/3]">
              <SafeImage src={mediaState.data?.tags?.some((tag) => tag.startsWith("custom-poster:")) ? mediaState.data.poster : mediaState.data?.isArabic ? imgOrPlaceholder(t.poster_path, "w342") : mediaState.data?.poster || imgOrPlaceholder(t.poster_path, "w342")} alt={displayTitle} fill variant="poster" />
            </div>
          </Card>
          <div className="tvtime-tv-detail-hero__poster-action">
            <OfficialPosterPicker tmdbId={t.id} mediaType="tv" title={displayTitle} posters={(t as any).images?.posters ?? []} />
          </div>
        </div>

        <div className="tvtime-tv-detail-hero__content min-w-0 space-y-5 md:pt-1">
          {/* Title and badges */}
          <div className="tvtime-tv-detail-hero__identity">
            <div className="tvtime-tv-detail-hero__user-state" aria-label={isArabicShow ? "حالة مشاهدتك" : "Your viewing status"}>
              <span className="tvtime-tv-detail-hero__user-state-label">{isArabicShow ? "حالتك" : "Your status"}</span>
              {effectiveLabel === "finished" && (
                <Badge data-status="finished" className="bg-emerald-500/20 text-emerald-400 border-0">
                  <Trophy className="w-3 h-3 mr-1" /> {isArabicShow ? "مكتمل" : "Finished"}
                </Badge>
              )}
              {effectiveLabel === "uptodate" && (
                <Badge data-status="uptodate" className="bg-cyan-500/20 text-cyan-400 border-0">
                  <Zap className="w-3 h-3 mr-1" /> {isArabicShow ? "مواكب للحلقات" : "Up To Date"}
                </Badge>
              )}
              {effectiveLabel === "watching" && (
                <Badge data-status="watching" className="bg-blue-500/20 text-blue-400 border-0">
                  <Play className="w-3 h-3 mr-1 fill-current" /> {isArabicShow ? "قيد المشاهدة" : "Watching"}
                </Badge>
              )}
              {effectiveLabel === "not_started" && (
                <Badge data-status="not_started" className="bg-slate-500/20 text-slate-300 border-0">{isArabicShow ? "لم يبدأ" : "Not Started"}</Badge>
              )}
              {effectiveLabel === "planned" && (
                <Badge data-status="planned" className="bg-violet-500/20 text-violet-300 border-0">{isArabicShow ? "ضمن الخطة" : "Planned"}</Badge>
              )}
            </div>
            <div className="tvtime-tv-detail-hero__meta">
              <Badge variant="secondary" className="bg-primary/20 text-primary border-0"><Tv className="w-3 h-3 mr-1" />{isArabicShow ? "مسلسل" : "TV Show"}</Badge>
              {isArabicShow && <Badge className="border-0 bg-amber-500/20 text-amber-300">مسلسل عربي</Badge>}
              {year && <Badge variant="secondary" className="border-0">{year}</Badge>}
              {t.number_of_seasons > 0 && <Badge variant="secondary" className="border-0"><Layers className="w-3 h-3 mr-1" />{isArabicShow ? `${t.number_of_seasons} موسم` : `${t.number_of_seasons} season${t.number_of_seasons > 1 ? "s" : ""}`}</Badge>}
              {runtime && <Badge variant="secondary" className="border-0"><Clock className="w-3 h-3 mr-1" />{runtime}</Badge>}
              {t.vote_average > 0 && (
                <Badge variant="secondary" className="bg-amber-500/20 text-amber-300 border-0"><Star className="w-3 h-3 mr-1 fill-amber-300" />{t.vote_average.toFixed(1)}</Badge>
              )}
              {contentRating && <Badge variant="secondary" className="bg-primary/30 text-primary border-0 font-bold">{contentRating}</Badge>}
              {t.status && <Badge variant="secondary" className="border-0">{t.status}</Badge>}
            </div>
            <h1 className="tvtime-tv-detail-hero__title view-page-title text-3xl sm:text-5xl lg:text-6xl font-black tracking-[-0.04em] leading-[0.95]">{displayTitle}</h1>
            {t.tagline && <p className="tvtime-tv-detail-hero__tagline text-base sm:text-lg italic text-foreground/70 mt-5">{t.tagline}</p>}
          </div>
          {/* Episode progress and following membership are intentionally separate. */}
          <div className="tvtime-detail-hero__actions tvtime-tv-detail-hero__actions">
            {isStopped ? (
              <Button variant="default" onClick={onFollow} disabled={followingToggle.isPending}>
                <Play className="fill-current" /> Resume Watching
              </Button>
            ) : isFollowing ? (
              <>
                <Button variant="default" onClick={onFollow} disabled={followingToggle.isPending}>
                  <Bell /> Following
                </Button>
                <Button variant="outline" onClick={() => setShowStopDialog(true)} className="border-rose-400/30 text-rose-300 hover:bg-rose-500/10 hover:text-rose-200" disabled={followingToggle.isPending}>
                  <CircleStop /> Stop Watching
                </Button>
              </>
            ) : inWatchlist ? (
              <>
                <Button variant="default" onClick={onWatchlist} disabled={watchlistToggle.isPending}>
                  <Check /> In watchlist
                </Button>
                <Button variant="secondary" onClick={onFollow} disabled={followingToggle.isPending}>
                  <Bell /> Follow
                </Button>
              </>
            ) : hasSavedProgress ? (
              <Button variant="outline" onClick={onFollow} disabled={followingToggle.isPending}>
                <Bell /> Follow
              </Button>
            ) : (
              <>
                <Button variant="secondary" onClick={onWatchlist} disabled={watchlistToggle.isPending}>
                  <ListPlus /> Plan to Watch
                </Button>
                <Button variant="outline" onClick={onFollow} disabled={followingToggle.isPending}>
                  <Bell /> Follow
                </Button>
              </>
            )}
            {trailer && (
              <Button variant="outline" onClick={() => window.open(`https://www.youtube.com/watch?v=${trailer.key}`, "_blank")}>
                <Play className="fill-current" /> Trailer
              </Button>
            )}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" className="tvtime-detail-hero__watch-button tvtime-tv-detail-hero__watch-button">
                  <ExternalLink /> Watch
                  <ChevronDown className="tvtime-detail-hero__watch-chevron tvtime-tv-detail-hero__watch-chevron" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="w-48">
                <DropdownMenuItem onSelect={() => window.open(`https://filmween.net/search?q=${encodeURIComponent(filmweenSearchTitle)}&mode=title`, "_blank", "noopener,noreferrer")}>
                  <ExternalLink /> Filmween
                </DropdownMenuItem>
                <DropdownMenuItem onSelect={() => window.open(`https://movie.vodu.me/index.php?do=list&title=${encodeURIComponent(voduSearchTitle)}`, "_blank", "noopener,noreferrer")}>
                  <ExternalLink /> Vodu
                </DropdownMenuItem>
                <DropdownMenuItem onSelect={() => window.open(`https://cinemana.shabakaty.com/search?videoTitle=${encodeURIComponent(cinemanaSearchTitle)}&staffTitle=${encodeURIComponent(cinemanaSearchTitle)}&year=1900,${new Date().getFullYear()}&type=series`, "_blank", "noopener,noreferrer")}>
                  <ExternalLink /> Cinemana
                </DropdownMenuItem>
                <DropdownMenuItem onSelect={() => window.open(`https://cinemana.cc/?s=${encodeURIComponent(displayTitle)}`, "_blank", "noopener,noreferrer")}>
                  <ExternalLink /> Cinemana Mod
                </DropdownMenuItem>
                <DropdownMenuItem onSelect={() => window.open(`https://cee.buzz/search?videoTitle=${encodeURIComponent(displayTitle)}&staffTitle=${encodeURIComponent(displayTitle)}&year=1900,${new Date().getFullYear()}&type=series`, "_blank", "noopener,noreferrer")}>
                  <ExternalLink /> CeeBuzz
                </DropdownMenuItem>
                <DropdownMenuItem onSelect={() => window.open(`https://kirmzi.sbs/search.php?keywords=${encodeURIComponent(displayTitle)}&video-id=`, "_blank", "noopener,noreferrer")}>
                  <ExternalLink /> Kirmzi
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>

          <Card className="tvtime-tv-detail-hero__rating-card rounded-2xl border-white/15 bg-black/25 p-5 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)] backdrop-blur-md">
            <div className="tvtime-tv-detail-hero__rating-grid grid grid-cols-1 items-center gap-5 md:grid-cols-[minmax(220px,1fr)_auto] xl:grid-cols-[minmax(260px,1fr)_auto_minmax(220px,auto)]">
              <div className="tvtime-tv-detail-hero__rating-summary flex min-w-0 items-center gap-4">
                <div>
                  <p className="text-xs text-muted-foreground mb-1">{isArabicShow ? "تقييمك" : "Your rating"}</p>
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
                        {hasWatchedEveryFinalEpisode && isEnded
                          ? "Rate to mark this show Finished"
                          : effectiveLabel === "uptodate"
                            ? "Rate later when show ends"
                            : isArabicShow ? "لم تقيّمه بعد" : "Not rated yet"}
                      </span>
                    </div>
                  )}
                </div>
              </div>
              <div className="tvtime-tv-detail-hero__rating-actions flex items-center gap-2 md:justify-self-end xl:justify-self-center">
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
                  {displayedShowRating != null ? "Re-rate" : canRateShow ? "Rate & finish" : "Rating locked"}
                </Button>
              </div>
              <div className="tvtime-tv-detail-hero__tmdb-rating md:col-span-2 md:justify-self-end xl:col-span-1 xl:text-right">
                <p className="text-xs text-muted-foreground mb-1">{isArabicShow ? "تقييم TMDB" : "TMDB score"}</p>
                <div className="flex items-center gap-1 text-amber-400 font-bold text-lg">
                  <Star className="w-5 h-5 fill-amber-400" />
                  {t.vote_average.toFixed(1)}
                  <span className="text-xs text-muted-foreground font-normal">/10 ({t.vote_count.toLocaleString()})</span>
                </div>
              </div>
              {showRatingLockMessage && (
                <div className="tvtime-tv-detail-hero__rating-lock flex items-start gap-2 rounded-xl border border-amber-500/25 bg-amber-500/[0.07] px-4 py-3 text-xs text-amber-100/90 md:col-span-2 xl:col-span-3">
                  <Lock className="w-4 h-4 mt-0.5 flex-shrink-0 text-amber-300" />
                  <span className="leading-relaxed">{showRatingLockMessage}</span>
                </div>
              )}
            </div>
          </Card>

          <div className="tvtime-tv-detail-hero__genres flex flex-wrap gap-2.5 [&>*]:rounded-xl [&>*]:px-4 [&>*]:py-2">
            {t.genres?.map((g) => (
              <Badge key={g.id} variant="outline" className="border-primary/30 text-primary/90">{g.name}</Badge>
            ))}
          </div>
          {t.created_by?.length > 0 && (
            <p className="tvtime-tv-detail-hero__creator text-sm text-muted-foreground">
              {isArabicShow ? "ابتكره" : "Created by"} <span className="text-foreground font-medium">{t.created_by.map((c) => c.name).join(", ")}</span>
            </p>
          )}
        </div>
      </div>
      </section>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList aria-label={isArabicShow ? "أقسام المسلسل" : "TV show sections"} className="tvtime-tv-detail-tabs flex h-14 w-full snap-x snap-proximity justify-start overflow-x-auto rounded-2xl border border-border/70 bg-muted/80 p-1.5 shadow-lg no-scrollbar [&>*]:h-full [&>*]:min-w-[120px] [&>*]:shrink-0 [&>*]:snap-start [&>*]:flex-none [&>*]:rounded-xl">
          <TabsTrigger value="seasons">{isArabicShow ? "المواسم والحلقات" : "Seasons & Episodes"}</TabsTrigger>
          <TabsTrigger value="overview">{isArabicShow ? "نظرة عامة" : "Overview"}</TabsTrigger>
          <TabsTrigger value="cast">{isArabicShow ? "طاقم العمل" : "Cast"}</TabsTrigger>
          {trailer && <TabsTrigger value="videos">{isArabicShow ? "الفيديوهات" : "Videos"}</TabsTrigger>}
        </TabsList>

        <TabsContent value="seasons" className="mt-4">
          <SeasonEpisodes
            tvId={t.id}
            seasons={seasons}
            defaultSeason={selectedSeason ?? defaultSeason}
            onSelectSeason={setSelectedSeason}
            isEnded={isEnded}
            showTitle={displayTitle}
            showPoster={t.poster_path}
            releasedEpisodeTimeline={progressEpisodesToWatchRefs(progress.allEpisodes)}
            watchPlanReady={!progress.isLoading && !progress.isError}
            onCompletion={(c) => {
              if (!c) return;
              if (c.needsRating) {
                setLastAutoPromptedShowId(String(t.id));
                setPendingCompletionRating(true);
                setRatingOpen(true);
                toast.info("All episodes watched. Add your rating to mark this show Finished.");
              } else if (c.newStatus === "uptodate") {
                toast.info("You're all caught up! More episodes coming soon.");
              }
            }}
          />
        </TabsContent>

        <TabsContent value="overview" className="space-y-4 mt-4">
          <div>
            <h3 className="text-lg font-bold mb-2">{isArabicShow ? "القصة" : "Synopsis"}</h3>
            <p className="text-foreground/80 leading-relaxed">{t.overview || (isArabicShow ? "لا يتوفر ملخص حالياً." : "No overview available.")}</p>
          </div>
          {t.networks?.length > 0 && (
            <div>
              <h4 className="text-sm font-bold mb-2">{isArabicShow ? "شبكات العرض" : "Networks"}</h4>
              <div className="flex flex-wrap gap-2">
                {t.networks.map((n) => (
                  <Badge key={n.id} variant="secondary">{n.name}</Badge>
                ))}
              </div>
            </div>
          )}
          {recommendations.length > 0 && (
            <MediaRow title={isArabicShow ? "اقتراحات لك" : "Recommendations"} icon={<Sparkles className="w-5 h-5" />} items={recommendations} forcedMediaType="tv" />
          )}
          {similar.length > 0 && (
            <MediaRow title={isArabicShow ? "أعمال مشابهة" : "More like this"} icon={<Heart className="w-5 h-5" />} items={similar} forcedMediaType="tv" />
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
                  <div className="relative w-12 h-12 rounded-full overflow-hidden bg-muted flex-shrink-0">
                    {c.profile_path ? (
                      <SafeImage src={img(c.profile_path, "w185")} alt={c.name} fill variant="profile" sizes="48px" className="transition-opacity duration-200 group-hover:opacity-90" />
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
            <p className="text-muted-foreground text-center py-8">{isArabicShow ? "لا تتوفر معلومات عن طاقم العمل." : "No cast information available."}</p>
          )}
        </TabsContent>

        {trailer && (
          <TabsContent value="videos" className="mt-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {videos.slice(0, 8).map((v: any) => (
                <button key={v.id} onClick={() => window.open(`https://www.youtube.com/watch?v=${v.key}`, "_blank")} className="group text-left">
                  <Card className="overflow-hidden p-0 hover:border-primary/40 transition-colors">
                    <div className="relative aspect-video bg-black">
                      <SafeImage src={`https://img.youtube.com/vi/${v.key}/hqdefault.jpg`} alt={v.name} fill variant="youtube" className="opacity-80 group-hover:opacity-100 transition-opacity" />
                      <div className="absolute inset-0 flex items-center justify-center">
                        <div className="w-12 h-12 rounded-full bg-primary/90 flex items-center justify-center transition-opacity duration-200 group-hover:opacity-90">
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
        onOpenChange={(open) => {
          setRatingOpen(open);
          if (!open) {
            setLastAutoPromptedShowId(String(t.id));
            setPendingCompletionRating(false);
          }
        }}
        title={displayTitle}
        poster={t.poster_path ? img(t.poster_path, "w185") : null}
        onRate={onRateSubmit}
        initialRating={myRating ?? null}
        description={myRating == null
          ? "Choose your rating out of 100 to mark this completed series Finished. Closing or cancelling keeps it Up To Date."
          : "Update your personal rating out of 100. The series remains Finished after saving."}
        submitLabel={myRating == null ? "Save rating & mark Finished" : "Update rating"}
        successMessage={(rating) => myRating == null
          ? `Marked as Finished · Your rating ${rating}/100`
          : `Updated your rating to ${rating}/100`}
      />

      {showStopDialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4" onClick={() => setShowStopDialog(false)}>
          <div className="w-full max-w-md space-y-5 rounded-2xl border border-rose-400/20 bg-card p-6 shadow-2xl" onClick={(event) => event.stopPropagation()}>
            <div className="flex items-start gap-3">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-rose-500/15">
                <CircleStop className="h-5 w-5 text-rose-300" />
              </div>
              <div>
                <h3 className="text-lg font-bold">Stop watching “{displayTitle}”?</h3>
                <p className="mt-1 text-sm text-muted-foreground">All watched episodes, ratings and rewatches will remain saved. The show will leave Watch Next and notifications.</p>
              </div>
            </div>
            <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <Button variant="ghost" onClick={() => setShowStopDialog(false)}>Cancel</Button>
              <Button variant="destructive" onClick={onStopWatching} disabled={followingToggle.isPending}>
                <CircleStop className="mr-2 h-4 w-4" /> Stop Watching
              </Button>
            </div>
          </div>
        </div>
      )}

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
                <h3 className="font-bold text-lg">Unfollow "{displayTitle}"?</h3>
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
  releasedEpisodeTimeline,
  watchPlanReady,
  onCompletion,
}: {
  tvId: number;
  seasons: { season_number: number; name: string; episode_count: number; air_date: string | null; poster_path: string | null; overview: string }[];
  defaultSeason: number | null;
  onSelectSeason: (n: number) => void;
  isEnded?: boolean;
  showTitle: string;
  showPoster: string | null;
  releasedEpisodeTimeline: WatchEpisodeRef[];
  watchPlanReady: boolean;
  onCompletion?: (c: EpisodeCompletion | null | undefined) => void;
}) {
  const [open, setOpen] = useState(false);
  const season = defaultSeason ?? seasons[0]?.season_number ?? 0;
  const seasonData = useSeasonDetail(tvId, season);
  const watched = useWatchedEpisodes(tvId);
  const episodeToggle = useEpisodeToggle();
  const bulkEpisodeToggle = useBulkEpisodeToggle();
  const showWatchUndo = useWatchUndo();
  const episodeRatings = useEpisodeRatings(tvId);
  const episodeRatingMutate = useEpisodeRatingMutate(tvId);
  const [ratingTarget, setRatingTarget] = useState<{
    seasonNumber: number;
    episodeNumber: number;
    episodeName: string;
    currentRating: number | null;
  } | null>(null);
  const [watchPlan, setWatchPlan] = useState<EpisodeWatchPlan | null>(null);

  const ratingByEpisode = new Map<string, number>(
    (episodeRatings.data?.items ?? []).map((rating) => [
      `${rating.seasonNumber}-${rating.episodeNumber}`,
      rating.value,
    ] as const),
  );

  const currentSeason = seasons.find((s) => s.season_number === season);
  const watchedSet = new Set<string>(
    (watched.data?.items ?? []).map((e: { seasonNumber: number; episodeNumber: number }) => `${e.seasonNumber}-${e.episodeNumber}`)
  );

  const isReleased = (episode: { air_date?: string | null; season_number: number }) =>
    episode.season_number >= 1 && (isEpisodeReleased(episode.air_date) || (isEnded && !episode.air_date));
  const isEpisodeWatched = (episode: { season_number: number; episode_number: number; air_date?: string | null }) =>
    isReleased(episode) && watchedSet.has(`${episode.season_number}-${episode.episode_number}`);
  const releasedEpisodes = (seasonData.data?.episodes ?? []).filter(isReleased);

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
            showId: tvId,
            seasonNumber: episodes[0].seasonNumber,
            episodeNumber: episodes[0].episodeNumber,
            episodeName: episodes[0].episodeName || undefined,
          })
        : await bulkEpisodeToggle.mutateAsync({ showId: tvId, episodes });
      const previousCount = includePrevious ? plan.previousUnwatched.length : 0;
      const selectedCount = plan.selectedEpisodes.length;
      showWatchUndo(
        previousCount > 0
          ? `Marked ${previousCount + selectedCount} released episodes as watched, including earlier gaps.`
          : plan.kind === "episode"
            ? `${plan.targetLabel} marked as watched.`
            : `${plan.targetLabel} marked as watched (${selectedCount} released episode${selectedCount === 1 ? "" : "s"}).`,
        result,
      );
      onCompletion?.(result?.completion);
      setWatchPlan(null);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to mark episodes");
    }
  };

  const markAllWatched = async () => {
    if (!watchPlanReady) {
      toast.error("Earlier episode history is still loading. Try again in a moment.");
      return;
    }
    const plan = buildSeasonWatchPlan({
      seasonNumber: season,
      releasedEpisodes: releasedEpisodeTimeline,
      watchedKeys: watchedSet,
    });
    if (plan.selectedEpisodes.length === 0) {
      toast.info(releasedEpisodes.length === 0 ? "No released episodes in this season yet" : "All released episodes already watched");
      return;
    }
    if (plan.previousUnwatched.length > 0) {
      setWatchPlan(plan);
      return;
    }
    await applyWatchPlan(plan, false);
  };

  const rewatchSeason = async () => {
    if (releasedEpisodes.length === 0 || releasedEpisodes.some((episode: any) => !isEpisodeWatched(episode))) {
      toast.info("Finish every released episode in this season before recording a full-season rewatch.");
      return;
    }
    if (!window.confirm(`Record one rewatch for all ${releasedEpisodes.length} released episodes in ${currentSeason?.name || `Season ${season}`}?`)) return;
    try {
      const result = await bulkEpisodeToggle.mutateAsync({
        showId: tvId,
        rewatch: true,
        episodes: releasedEpisodes.map((episode: any) => ({ seasonNumber: episode.season_number, episodeNumber: episode.episode_number, episodeName: episode.name || null })),
      });
      showWatchUndo(`${currentSeason?.name || `Season ${season}`} rewatch recorded for every released episode.`, result);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to record season rewatch");
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

    if (isWatched) {
      try {
        const result = await episodeToggle.mutateAsync({
          action: "remove",
          showId: tvId,
          seasonNumber: sn,
          episodeNumber: en,
          episodeName: name,
        });
        showWatchUndo(`S${sn}E${en} marked as unwatched.`, result);
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "Failed to update episode");
      }
      return;
    }

    if (!watchPlanReady) {
      toast.error("Earlier episode history is still loading. Try again in a moment.");
      return;
    }

    const plan = buildEpisodeWatchPlan({
      target: { seasonNumber: sn, episodeNumber: en, episodeName: name },
      releasedEpisodes: releasedEpisodeTimeline,
      watchedKeys: watchedSet,
    });
    if (plan.previousUnwatched.length > 0) {
      setWatchPlan(plan);
      return;
    }
    await applyWatchPlan(plan, false);
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

  const recordEpisodeRewatch = async (episode: { season_number: number; episode_number: number; name: string }) => {
    try {
      const result = await episodeToggle.mutateAsync({ action: "rewatch", showId: tvId, seasonNumber: episode.season_number, episodeNumber: episode.episode_number, episodeName: episode.name });
      showWatchUndo(`S${episode.season_number}E${episode.episode_number} rewatch recorded.`, result);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to record rewatch");
    }
  };

  return (
    <div className="space-y-4">
      {/* Season selector */}
      <div className="tvtime-season-toolbar flex items-center justify-between gap-3 flex-wrap">
        <div className="tvtime-season-selector relative">
          <button
            onClick={() => setOpen((o) => !o)}
            className="tvtime-season-selector__button flex items-center gap-2 px-4 py-2 rounded-lg bg-secondary text-sm font-semibold hover:bg-accent transition-colors min-w-[180px]"
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

        <div className="tvtime-season-actions flex items-center gap-2 flex-wrap">
          <Button variant="outline" size="sm" onClick={markAllWatched} disabled={seasonData.isLoading || bulkEpisodeToggle.isPending || episodeToggle.isPending || releasedEpisodes.length === 0 || !watchPlanReady}>
            <CheckCheck className="w-4 h-4 mr-1.5" /> Mark season watched
          </Button>
          <Button variant="secondary" size="sm" onClick={() => void rewatchSeason()} disabled={seasonData.isLoading || bulkEpisodeToggle.isPending || episodeToggle.isPending || releasedEpisodes.length === 0 || releasedEpisodes.some((episode: any) => !isEpisodeWatched(episode))}>
            <RotateCcw className="w-4 h-4 mr-1.5" /> Rewatch season
          </Button>
        </div>
      </div>

      {/* Progress */}
      {seasonData.data && (
        <div className="tvtime-season-progress flex items-center gap-3 text-sm">
          <div className="flex-1 h-2 rounded-full bg-muted overflow-hidden">
            <div
              className="h-full bg-primary transition-[width] duration-300"
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
                    disabled={!released || (!isWatched && !watchPlanReady)}
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
                    <div className="relative aspect-video rounded-md overflow-hidden bg-muted">
                      {ep.still_path ? (
                      <SafeImage src={img(ep.still_path, "w300")} alt={ep.name} fill variant="still" />
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
                      {isWatched && <Button type="button" variant="outline" size="sm" className="h-7 text-[11px]" onClick={() => void recordEpisodeRewatch(ep)} disabled={episodeToggle.isPending}>Rewatch ({(watched.data?.items ?? []).find((item: any) => item.seasonNumber === ep.season_number && item.episodeNumber === ep.episode_number)?.rewatchCount ?? 0})</Button>}
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
      <EpisodeWatchConfirmationDialog
        plan={watchPlan}
        open={Boolean(watchPlan)}
        pending={episodeToggle.isPending || bulkEpisodeToggle.isPending}
        onOpenChange={(nextOpen) => { if (!nextOpen) setWatchPlan(null); }}
        onSelectedOnly={() => watchPlan ? applyWatchPlan(watchPlan, false) : undefined}
        onWithPrevious={() => watchPlan ? applyWatchPlan(watchPlan, true) : undefined}
      />
    </div>
  );
}
