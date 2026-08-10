"use client";

import { useNav } from "@/lib/store";
import { useMovieDetail, useWatchlistToggle, useWatchedMovieToggle, useRatingMutate, useMediaState } from "@/hooks/use-tmdb";
import { getTitle, img, imgOrPlaceholder, type MediaItem } from "@/lib/tmdb";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { RatingDialog } from "@/components/media/rating-dialog";
import { MediaRow } from "@/components/media/media-row";
import { SafeImage } from "@/components/media/safe-image";
import { OfficialPosterPicker } from "@/components/media/official-poster-picker";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import {
  Star, Clock, Calendar, Play, Check, ListPlus, CheckCircle2, Circle, ArrowLeft,
  DollarSign, Film, Users, Sparkles, Heart, Loader2, ExternalLink, ChevronDown,
} from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { formatReleaseDateParts } from "@/lib/date-only";
import { detectIsArabic } from "@/lib/arabic-media";
import {
  filterAndPrioritizeMediaCollectionWorldItems,
  mediaCollectionWorldForItem,
} from "@/lib/media-world-pipeline";
import { useWatchUndo } from "@/hooks/use-watch-undo";

export function MovieDetailView() {
  const { movieId, back, goPerson } = useNav();
  // Fix #3/#15: Use direct state lookup by tmdbId instead of paginated hooks
  // that only return first 100 items. This fixes movies beyond page 1 not
  // showing as watched/rated/watchlisted.
  const mediaState = useMediaState(movieId, "movie");
  const detail = useMovieDetail(movieId, mediaState.data?.isArabic ? "ar" : undefined);
  const watchlistToggle = useWatchlistToggle();
  const watchedToggle = useWatchedMovieToggle();
  const ratingMutate = useRatingMutate();
  const showWatchUndo = useWatchUndo();

  const [activeTab, setActiveTab] = useState("overview");
  const [ratingIntent, setRatingIntent] = useState<"complete" | "edit" | null>(null);

  if (detail.isLoading) {
    return (
      <div className="space-y-4">
        <div className="h-[40vh] sm:h-[50vh] shimmer rounded-2xl" />
        <div className="flex gap-4">
          <div className="w-32 h-48 shimmer rounded-lg flex-shrink-0" />
          <div className="flex-1 space-y-2">
            <div className="h-8 shimmer rounded w-3/4" />
            <div className="h-4 shimmer rounded w-1/2" />
            <div className="h-4 shimmer rounded w-2/3" />
          </div>
        </div>
      </div>
    );
  }

  if (detail.isError || !detail.data) {
    return (
      <div className="text-center py-20 text-muted-foreground">
        <p>Failed to load movie.</p>
        <Button variant="outline" className="mt-4" onClick={back}>Go back</Button>
      </div>
    );
  }

  const m = detail.data;
  const displayTitle = getTitle(m);
  // Direct identity lookup is the only source for detail-page state. It does
  // not depend on the first page of Watchlist/Watched/Ratings collections.
  const stateItem = mediaState.data;
  const inWatchlist = stateItem?.status === "planned" && stateItem?.watched !== true;
  const isWatched = stateItem?.watched === true;
  const myRating = stateItem?.userRating ?? null;

  const runtime = m.runtime ? `${Math.floor(m.runtime / 60)}h ${m.runtime % 60}m` : null;
  const releaseDate = formatReleaseDateParts(m.release_date);
  const originCountries = (m.production_countries ?? []).map((country) => country.iso_3166_1);
  const genreNames = (m.genres ?? []).map((genre) => genre.name);
  const isArabicMovie = detectIsArabic({ originalLanguage: m.original_language, originCountry: originCountries });
  const collectionWorld = mediaCollectionWorldForItem({
    type: "movie",
    title: displayTitle,
    originalLanguage: m.original_language,
    originCountries,
    genres: genreNames,
    classificationComplete: true,
  }, "movie");
  const filmweenSearchTitle = isArabicMovie ? ((m as any).english_title || displayTitle) : displayTitle;
  const voduSearchTitle = displayTitle;
  const cinemanaSearchTitle = displayTitle;

  const cast = (m as any).credits?.cast?.slice(0, 16) ?? [];
  const recommendationCandidates = (((m as any).recommendations?.results ?? []) as MediaItem[])
    .filter((result: any) => result.poster_path);
  const similarCandidates = (((m as any).similar?.results ?? []) as MediaItem[])
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
  const videos = ((m as any).videos?.results ?? []).filter((v: any) => v.site === "YouTube");
  const trailer = videos.find((v: any) => v.type === "Trailer") || videos[0];

  // Extract content rating (MPAA for US)
  const releaseDates = (m as any).release_dates?.results ?? [];
  const usRelease = releaseDates.find((r: any) => r.iso_3166_1 === "US");
  const contentRating = usRelease?.release_dates?.find((r: any) => r.certification)?.certification || null;

  const onWatchlist = async () => {
    try {
      await watchlistToggle.mutateAsync({
        action: inWatchlist ? "remove" : "add",
        mediaType: "movie",
        tmdbId: m.id,
        title: displayTitle,
        posterPath: m.poster_path,
        backdropPath: m.backdrop_path,
        overview: m.overview,
        releaseDate: m.release_date,
        voteAverage: m.vote_average,
        runtime: m.runtime,
        genres: genreNames,
        originCountry: originCountries,
        originalLanguage: m.original_language,
      });
      toast.success(inWatchlist ? "Removed from watchlist" : "Added to watchlist");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to update watchlist");
    }
  };

  const onWatched = async () => {
    if (!isWatched) {
      if (myRating == null) {
        setRatingIntent("complete");
        return;
      }
      try {
        const result = await watchedToggle.mutateAsync({
          action: "add",
          tmdbId: m.id,
          title: displayTitle,
          posterPath: m.poster_path,
          runtime: m.runtime,
          releaseDate: m.release_date,
          voteAverage: m.vote_average,
          overview: m.overview,
          genres: genreNames,
          originCountry: originCountries,
          originalLanguage: m.original_language,
          userRating: myRating,
        });
        showWatchUndo(`Marked as watched · Your rating ${myRating}/100`, result);
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "Failed to update watch status");
      }
      return;
    }

    try {
      const result = await watchedToggle.mutateAsync({
        action: "remove",
        tmdbId: m.id,
        title: displayTitle,
        posterPath: m.poster_path,
        runtime: m.runtime,
        releaseDate: m.release_date,
        voteAverage: m.vote_average,
        overview: m.overview,
        genres: genreNames,
        originCountry: originCountries,
        originalLanguage: m.original_language,
      });
      showWatchUndo("Marked as not watched", result);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to update watch status");
    }
  };

  const onRewatch = async () => {
    try {
      const result = await watchedToggle.mutateAsync({ action: "rewatch", tmdbId: m.id, title: displayTitle, posterPath: m.poster_path, runtime: m.runtime });
      showWatchUndo("Rewatch recorded", result);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to record rewatch");
    }
  };

  const onRateSubmit = async (v: number) => {
    if (ratingIntent === "complete") {
      return watchedToggle.mutateAsync({
        action: "add",
        tmdbId: m.id,
        title: displayTitle,
        posterPath: m.poster_path,
        runtime: m.runtime,
        releaseDate: m.release_date,
        voteAverage: m.vote_average,
        overview: m.overview,
        genres: genreNames,
        originCountry: originCountries,
        originalLanguage: m.original_language,
        userRating: v,
      });
    }
    if (!isWatched) throw new Error("Mark this movie watched before rating it.");
    return ratingMutate.mutateAsync({
      action: "set",
      mediaType: "movie",
      tmdbId: m.id,
      value: v,
      title: displayTitle,
      posterPath: m.poster_path,
      releaseDate: m.release_date,
      voteAverage: m.vote_average,
      runtime: m.runtime,
      overview: m.overview,
      genres: genreNames,
      originCountry: originCountries,
      originalLanguage: m.original_language,
    });
  };

  const onRemoveRating = async () => {
    try {
      const result = await ratingMutate.mutateAsync({ action: "remove", mediaType: "movie", tmdbId: m.id });
      showWatchUndo("Rating removed and movie marked as not watched", result);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to remove rating");
    }
  };

  const ratingColor = myRating == null
    ? "text-muted-foreground"
    : myRating >= 80 ? "text-emerald-400"
    : myRating >= 60 ? "text-amber-400"
    : myRating >= 40 ? "text-orange-400"
    : "text-rose-400";
  const stateLoading = mediaState.isLoading && !stateItem;

  return (
    <div className="tvtime-movie-detail-page space-y-5">
      <Button variant="ghost" size="sm" onClick={back} className="tvtime-detail-back-button text-muted-foreground">
        <ArrowLeft className="w-4 h-4 mr-1" /> {isArabicMovie ? "رجوع" : "Back"}
      </Button>

      <section className="tvtime-movie-detail-hero relative isolate overflow-hidden border border-white/15 bg-[#07101f]">
        {/* Hero backdrop */}
        <div data-ui-surface="hero" className="absolute inset-0 -z-20 overflow-hidden">
          <div className="absolute inset-0">
            <SafeImage src={img(m.backdrop_path, "w1280")} alt={displayTitle} fill variant="backdrop" priority className="absolute inset-0" />
            <div className="absolute inset-0 bg-[linear-gradient(90deg,rgba(3,9,19,0.82)_0%,rgba(4,12,25,0.68)_45%,rgba(3,8,18,0.52)_100%)]" />
            <div className="absolute inset-0 bg-gradient-to-t from-[#050b16]/95 via-[#07101f]/35 to-[#07101f]/35" />
          </div>
        </div>

        {/* Poster + title + actions */}
        <div className="tvtime-movie-detail-hero__layout relative z-10">
          <aside className="tvtime-movie-detail-hero__poster">
            <Card className="p-0 overflow-hidden rounded-[22px] border-white/25 bg-black/30 shadow-[0_24px_55px_rgba(0,0,0,0.5)]">
              <div className="relative aspect-[2/3]">
                <SafeImage src={stateItem?.poster || imgOrPlaceholder(m.poster_path, "w342")} alt={displayTitle} fill variant="poster" />
              </div>
            </Card>
            <div className="tvtime-movie-detail-hero__poster-action">
              <OfficialPosterPicker tmdbId={m.id} mediaType="movie" title={displayTitle} posters={(m as any).images?.posters ?? []} />
            </div>
          </aside>

          <div className="tvtime-movie-detail-hero__content">
            <header className="tvtime-movie-detail-hero__identity">
              <div className="tvtime-movie-detail-hero__eyebrow">
                <span className="tvtime-movie-detail-hero__kind">
                  <Film aria-hidden="true" /> {isArabicMovie ? "فيلم" : "Movie"}
                </span>
                {releaseDate?.year && <span>{releaseDate.year}</span>}
                {isArabicMovie && (
                  <span className="tvtime-movie-detail-hero__arabic">
                    فيلم عربي
                  </span>
                )}
              </div>
              <h1 className="tvtime-movie-detail-hero__title view-page-title">
                {displayTitle}
              </h1>
              {m.tagline && <p className="tvtime-movie-detail-hero__tagline">{m.tagline}</p>}
              <div className="tvtime-movie-detail-genres" aria-label="Movie genres">
                {m.genres?.map((genre) => (
                  <Badge key={genre.id} variant="outline">{genre.name}</Badge>
                ))}
              </div>
            </header>

            <div className="tvtime-movie-detail-hero__facts" aria-label="Movie facts">
              {releaseDate && (
                <span>
                  <Calendar aria-hidden="true" /> {releaseDate.dayMonth}
                </span>
              )}
              {runtime && (
                <span>
                  <Clock aria-hidden="true" /> {runtime}
                </span>
              )}
              {m.vote_average > 0 && (
                <span className="is-score">
                  <Star className="fill-current" aria-hidden="true" /> {m.vote_average.toFixed(1)}
                </span>
              )}
              {contentRating && <span className="is-rating">{contentRating}</span>}
              {m.status && <span>{m.status}</span>}
            </div>

            {/* Library actions remain disabled until their canonical state is known. */}
            <div className="tvtime-detail-hero__actions tvtime-movie-detail-hero__actions">
              <Button
                variant={isWatched ? "default" : "secondary"}
                onClick={onWatched}
                disabled={stateLoading || watchedToggle.isPending}
              >
                {stateLoading ? <Loader2 className="animate-spin" /> : isWatched ? <CheckCircle2 /> : <Circle />}
                {isWatched ? "Watched" : "Mark watched"}
              </Button>
              {isWatched ? (
                <Button variant="outline" onClick={() => void onRewatch()} disabled={watchedToggle.isPending}>
                  <CheckCircle2 /> Rewatch ({stateItem?.rewatchCount ?? 0})
                </Button>
              ) : (
                <Button
                  variant={inWatchlist ? "default" : "secondary"}
                  onClick={onWatchlist}
                  disabled={stateLoading || watchlistToggle.isPending}
                >
                  {inWatchlist ? <Check /> : <ListPlus />}
                  {inWatchlist ? "In watchlist" : "Add to watchlist"}
                </Button>
              )}
              {trailer && (
                <Button
                  variant="outline"
                  onClick={() => window.open(`https://www.youtube.com/watch?v=${trailer.key}`, "_blank")}
                >
                  <Play className="fill-current" /> Trailer
                </Button>
              )}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" className="tvtime-detail-hero__watch-button tvtime-movie-detail-hero__watch-button">
                    <ExternalLink /> Watch
                    <ChevronDown className="tvtime-detail-hero__watch-chevron tvtime-movie-detail-hero__watch-chevron" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start" className="w-48">
                  <DropdownMenuItem onSelect={() => window.open(`https://filmween.net/search?q=${encodeURIComponent(filmweenSearchTitle)}&mode=title`, "_blank", "noopener,noreferrer")}>
                    <ExternalLink /> Filmween
                  </DropdownMenuItem>
                  <DropdownMenuItem onSelect={() => window.open(`https://movie.vodu.me/index.php?do=list&title=${encodeURIComponent(voduSearchTitle)}`, "_blank", "noopener,noreferrer")}>
                    <ExternalLink /> Vodu
                  </DropdownMenuItem>
                  <DropdownMenuItem onSelect={() => window.open(`https://cinemana.shabakaty.com/search?videoTitle=${encodeURIComponent(cinemanaSearchTitle)}&staffTitle=${encodeURIComponent(cinemanaSearchTitle)}&year=1900,${new Date().getFullYear()}&type=movies`, "_blank", "noopener,noreferrer")}>
                    <ExternalLink /> Cinemana
                  </DropdownMenuItem>
                  <DropdownMenuItem onSelect={() => window.open(`https://cinemana.cc/?s=${encodeURIComponent(displayTitle)}`, "_blank", "noopener,noreferrer")}>
                    <ExternalLink /> Cinemana Mod
                  </DropdownMenuItem>
                  <DropdownMenuItem onSelect={() => window.open(`https://cee.buzz/search?videoTitle=${encodeURIComponent(displayTitle)}&staffTitle=${encodeURIComponent(displayTitle)}&year=1900,${new Date().getFullYear()}&type=movies`, "_blank", "noopener,noreferrer")}>
                    <ExternalLink /> CeeBuzz
                  </DropdownMenuItem>
                  <DropdownMenuItem onSelect={() => window.open(`https://kirmzi.sbs/search.php?keywords=${encodeURIComponent(displayTitle)}&video-id=`, "_blank", "noopener,noreferrer")}>
                    <ExternalLink /> Kirmzi
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>

            {/* Rating */}
            <Card className="tvtime-movie-detail-rating">
              <div className="tvtime-movie-detail-rating__grid">
                <div className="tvtime-movie-detail-rating__user">
                  <p>{isArabicMovie ? "تقييمك" : "Your rating"}</p>
                  {myRating != null ? (
                    <div className="tvtime-movie-detail-rating__value">
                      <strong className={ratingColor}>
                        {myRating}<span>/100</span>
                      </strong>
                      <span className="tvtime-movie-detail-rating__track" aria-hidden="true">
                        <span style={{ width: `${myRating}%` }} />
                      </span>
                    </div>
                  ) : (
                    <div className="tvtime-movie-detail-rating__empty">
                      <strong>—</strong>
                      <span>{isArabicMovie ? "لم تقيّمه بعد" : "Not rated yet"}</span>
                    </div>
                  )}
                </div>
                <div className="tvtime-movie-detail-rating__tmdb">
                  <p>{isArabicMovie ? "تقييم TMDB" : "TMDB score"}</p>
                  <div>
                    <Star className="fill-current" />
                    <strong>{m.vote_average.toFixed(1)}</strong>
                    <span>/10 ({m.vote_count.toLocaleString()})</span>
                  </div>
                </div>
                {isWatched && (
                  <div className="tvtime-movie-detail-rating__controls">
                    {myRating != null && (
                      <Button variant="outline" size="sm" onClick={onRemoveRating}>
                        Remove rating &amp; watched
                      </Button>
                    )}
                    <Button size="sm" onClick={() => setRatingIntent("edit")}>
                      <Star className="fill-current" />
                      {myRating != null ? "Re-rate" : "Rate out of 100"}
                    </Button>
                  </div>
                )}
              </div>
            </Card>

          </div>
        </div>
      </section>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="flex h-14 w-full justify-stretch overflow-x-auto rounded-2xl border border-white/10 bg-[#0a1220]/90 p-1.5 shadow-lg no-scrollbar [&>*]:h-full [&>*]:min-w-[120px] [&>*]:flex-1 [&>*]:rounded-xl">
          <TabsTrigger value="overview">{isArabicMovie ? "نظرة عامة" : "Overview"}</TabsTrigger>
          <TabsTrigger value="cast">{isArabicMovie ? "طاقم العمل" : "Cast"}</TabsTrigger>
          {m.budget > 0 && <TabsTrigger value="details">{isArabicMovie ? "التفاصيل" : "Details"}</TabsTrigger>}
          {trailer && <TabsTrigger value="videos">{isArabicMovie ? "الفيديوهات" : "Videos"}</TabsTrigger>}
        </TabsList>

        <TabsContent value="overview" className="space-y-4 mt-4">
          <div>
            <h3 className="text-lg font-bold mb-2">{isArabicMovie ? "القصة" : "Synopsis"}</h3>
            <p className="text-foreground/80 leading-relaxed">{m.overview || "No overview available."}</p>
          </div>
          {recommendations.length > 0 && (
            <MediaRow title={isArabicMovie ? "اقتراحات لك" : "Recommendations"} icon={<Sparkles className="w-5 h-5" />} items={recommendations} forcedMediaType="movie" />
          )}
          {similar.length > 0 && (
            <MediaRow title={isArabicMovie ? "أعمال مشابهة" : "More like this"} icon={<Heart className="w-5 h-5" />} items={similar} forcedMediaType="movie" />
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
            <p className="text-muted-foreground text-center py-8">{isArabicMovie ? "لا تتوفر معلومات عن طاقم العمل." : "No cast information available."}</p>
          )}
        </TabsContent>

        {m.budget > 0 && (
          <TabsContent value="details" className="mt-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <DetailCard icon={<DollarSign className="w-5 h-5 text-emerald-400" />} label={isArabicMovie ? "الميزانية" : "Budget"} value={`$${m.budget.toLocaleString()}`} />
              <DetailCard icon={<DollarSign className="w-5 h-5 text-emerald-400" />} label={isArabicMovie ? "الإيرادات" : "Revenue"} value={`$${m.revenue.toLocaleString()}`} />
              <DetailCard icon={<Calendar className="w-5 h-5 text-primary" />} label={isArabicMovie ? "تاريخ الإصدار" : "Release date"} value={releaseDate?.full || "—"} />
              <DetailCard icon={<Clock className="w-5 h-5 text-primary" />} label={isArabicMovie ? "المدة" : "Runtime"} value={runtime || "—"} />
              <DetailCard icon={<Film className="w-5 h-5 text-primary" />} label={isArabicMovie ? "الحالة" : "Status"} value={m.status || "—"} />
              <DetailCard icon={<Users className="w-5 h-5 text-primary" />} label={isArabicMovie ? "اللغة" : "Language"} value={m.spoken_languages?.map((l) => l.name || l.english_name).join(", ") || "—"} />
            </div>
            {m.production_companies?.length > 0 && (
              <div className="mt-4">
                <h4 className="text-sm font-bold mb-2">{isArabicMovie ? "الإنتاج" : "Production"}</h4>
                <div className="flex flex-wrap gap-2">
                  {m.production_companies.map((p) => (
                    <Badge key={p.id} variant="secondary">{p.name}</Badge>
                  ))}
                </div>
              </div>
            )}
          </TabsContent>
        )}

        {trailer && (
          <TabsContent value="videos" className="mt-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {videos.slice(0, 8).map((v: any) => (
                <button
                  key={v.id}
                  onClick={() => window.open(`https://www.youtube.com/watch?v=${v.key}`, "_blank")}
                  className="group text-left"
                >
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

      {/* Rating dialog — out of 100 */}
      <RatingDialog
        open={ratingIntent !== null}
        onOpenChange={(open) => {
          if (!open) setRatingIntent(null);
        }}
        title={displayTitle}
        poster={m.poster_path ? img(m.poster_path, "w185") : null}
        onRate={onRateSubmit}
        initialRating={myRating}
        description={ratingIntent === "complete"
          ? "Choose your rating out of 100 to mark this movie watched. Closing or cancelling keeps it unwatched."
          : "Update your personal rating out of 100."}
        submitLabel={ratingIntent === "complete" ? "Save rating & mark watched" : "Save rating"}
        successMessage={ratingIntent === "complete"
          ? (rating) => `Marked as watched · Your rating ${rating}/100`
          : (rating) => `Rated ${rating}/100`}
      />
    </div>
  );
}

function DetailCard({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <Card className="p-4 flex items-center gap-3">
      <div className="w-10 h-10 rounded-lg bg-accent flex items-center justify-center flex-shrink-0">{icon}</div>
      <div>
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className="font-semibold">{value}</p>
      </div>
    </Card>
  );
}
