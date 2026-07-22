"use client";

import { useNav } from "@/lib/store";
import { useMovieDetail, useWatchlistToggle, useWatchedMovieToggle, useRatingMutate, useMediaState } from "@/hooks/use-tmdb";
import { img, imgOrPlaceholder } from "@/lib/tmdb";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { RatingDialog } from "@/components/media/rating-dialog";
import { MediaRow } from "@/components/media/media-row";
import { SafeImage } from "@/components/media/safe-image";
import { OfficialPosterPicker } from "@/components/media/official-poster-picker";
import { WatchProviders } from "@/components/media/watch-providers";
import {
  Star, Clock, Calendar, Play, Check, ListPlus, CheckCircle2, Circle, ArrowLeft,
  DollarSign, Film, Users, Sparkles, Heart, Loader2,
} from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { formatReleaseDateParts } from "@/lib/date-only";
import { detectIsArabic, isArabicMediaItem } from "@/lib/arabic-media";

export function MovieDetailView() {
  const { movieId, back, goPerson } = useNav();
  const detail = useMovieDetail(movieId);
  // Fix #3/#15: Use direct state lookup by tmdbId instead of paginated hooks
  // that only return first 100 items. This fixes movies beyond page 1 not
  // showing as watched/rated/watchlisted.
  const mediaState = useMediaState(movieId, "movie");
  const watchlistToggle = useWatchlistToggle();
  const watchedToggle = useWatchedMovieToggle();
  const ratingMutate = useRatingMutate();

  const [activeTab, setActiveTab] = useState("overview");
  const [ratingOpen, setRatingOpen] = useState(false);

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

  const cast = (m as any).credits?.cast?.slice(0, 16) ?? [];
  const recommendations = ((m as any).recommendations?.results ?? [])
    .filter((result: any) => result.poster_path && isArabicMediaItem(result) === isArabicMovie)
    .slice(0, 20);
  const similar = ((m as any).similar?.results ?? [])
    .filter((result: any) => result.poster_path && isArabicMediaItem(result) === isArabicMovie)
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
        title: m.title || "Untitled",
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
    try {
      await watchedToggle.mutateAsync({
        action: isWatched ? "remove" : "add",
        tmdbId: m.id,
        title: m.title || "Untitled",
        posterPath: m.poster_path,
        runtime: m.runtime,
        releaseDate: m.release_date,
        voteAverage: m.vote_average,
        overview: m.overview,
        genres: genreNames,
        originCountry: originCountries,
        originalLanguage: m.original_language,
      });
      toast.success(isWatched ? "Marked as not watched" : "Marked as watched");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to update watch status");
    }
  };

  const onRewatch = async () => {
    try {
      await watchedToggle.mutateAsync({ action: "rewatch", tmdbId: m.id, title: m.title || "Untitled", posterPath: m.poster_path, runtime: m.runtime });
      toast.success("Rewatch recorded");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to record rewatch");
    }
  };

  const onRateSubmit = async (v: number) => {
    if (!isWatched) return;
    await ratingMutate.mutateAsync({
      action: "set",
      mediaType: "movie",
      tmdbId: m.id,
      value: v,
      title: m.title || "Untitled",
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
      await ratingMutate.mutateAsync({ action: "remove", mediaType: "movie", tmdbId: m.id });
      toast.success("Rating removed");
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

  return (
    <div className="tvtime-movie-detail-page space-y-5">
      <Button variant="ghost" size="sm" onClick={back} className="text-muted-foreground">
        <ArrowLeft className="w-4 h-4 mr-1" /> Back
      </Button>

      <section className="relative isolate overflow-hidden rounded-[28px] border border-white/15 bg-[#07101f] shadow-[0_30px_90px_rgba(0,0,0,0.45)]">
      {/* Hero backdrop */}
      <div data-ui-surface="hero" className="absolute inset-0 -z-20 overflow-hidden">
        <div className="absolute inset-0">
          <SafeImage src={img(m.backdrop_path, "w1280")} alt={m.title} fill variant="backdrop" priority className="absolute inset-0" />
          <div className="absolute inset-0 bg-[linear-gradient(90deg,rgba(3,9,19,0.82)_0%,rgba(4,12,25,0.68)_45%,rgba(3,8,18,0.52)_100%)]" />
          <div className="absolute inset-0 bg-gradient-to-t from-[#050b16]/95 via-[#07101f]/35 to-[#07101f]/35" />
        </div>
      </div>

      {/* Poster + title + actions */}
      <div className="relative z-10 grid grid-cols-1 gap-6 p-5 sm:p-7 md:grid-cols-[220px_minmax(0,1fr)] md:gap-8 lg:grid-cols-[270px_minmax(0,1fr)] lg:p-10">
        <div className="w-36 flex-shrink-0 mx-auto sm:w-52 md:w-full md:mx-0">
          <Card className="p-0 overflow-hidden rounded-[22px] border-white/25 bg-black/30 shadow-[0_24px_55px_rgba(0,0,0,0.5)]">
            <div className="relative aspect-[2/3]">
              <SafeImage src={stateItem?.poster || imgOrPlaceholder(m.poster_path, "w342")} alt={m.title} fill variant="poster" />
            </div>
          </Card>
        </div>

        <div className="min-w-0 space-y-5 md:pt-1">
          {/* Title and badges */}
          <div>
            <div className="mb-5 flex flex-wrap items-center gap-2.5 [&>*]:inline-flex [&>*]:h-10 [&>*]:items-center [&>*]:rounded-xl [&>*]:px-4 [&>*]:text-sm [&>*]:font-semibold">
              <Badge variant="secondary" className="bg-primary/20 text-primary border-0">
                <Film className="w-3 h-3 mr-1" /> Movie
              </Badge>
              {isArabicMovie && (
                <Badge className="border-0 bg-emerald-500/20 text-emerald-300">
                  Arabic Movie
                </Badge>
              )}
              {releaseDate && (
                <>
                  <Badge variant="secondary" className="border-0">
                    <Calendar className="w-3 h-3 mr-1" /> {releaseDate.dayMonth}
                  </Badge>
                  <Badge className="border-0 bg-primary text-primary-foreground font-extrabold tracking-wide">
                    {releaseDate.year}
                  </Badge>
                </>
              )}
              {runtime && <Badge variant="secondary" className="border-0"><Clock className="w-3 h-3 mr-1" />{runtime}</Badge>}
              {m.vote_average > 0 && (
                <Badge variant="secondary" className="bg-amber-500/20 text-amber-300 border-0">
                  <Star className="w-3 h-3 mr-1 fill-amber-300" /> {m.vote_average.toFixed(1)}
                </Badge>
              )}
              {contentRating && <Badge variant="secondary" className="bg-primary/30 text-primary border-0 font-bold">{contentRating}</Badge>}
              {m.status && <Badge variant="secondary" className="border-0">{m.status}</Badge>}
            </div>
            <h1 className="view-page-title text-3xl sm:text-5xl lg:text-6xl font-black tracking-[-0.04em] leading-[0.95]">
              {m.title}
            </h1>
            {m.tagline && <p className="text-base sm:text-lg italic text-foreground/70 mt-5">{m.tagline}</p>}
          </div>
          {/* Action buttons */}
          {/* Fix #15: Disable action buttons while library state is loading
              to prevent false initial state (all false/null) from flashing */}
          {(() => {
            const stateLoading = mediaState.isLoading && !stateItem;
            return (
          <div className="flex flex-wrap items-center gap-3 [&>*]:h-12 [&>*]:rounded-xl [&_button]:h-12 [&_button]:min-w-[150px] [&_button]:justify-center [&_button]:rounded-xl [&_button]:px-5 [&_button]:text-sm [&_button]:font-semibold">
            <OfficialPosterPicker tmdbId={m.id} mediaType="movie" title={m.title || "Untitled"} posters={(m as any).images?.posters ?? []} />
            <Button
              variant={isWatched ? "default" : "secondary"}
              onClick={onWatched}
              className="h-10"
              disabled={stateLoading || watchedToggle.isPending}
            >
              {stateLoading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : isWatched ? <CheckCircle2 className="w-4 h-4 mr-2" /> : <Circle className="w-4 h-4 mr-2" />}
              {isWatched ? "Watched" : "Mark watched"}
            </Button>
            {isWatched && <Button variant="outline" onClick={() => void onRewatch()} className="h-10" disabled={watchedToggle.isPending}>Rewatch ({stateItem?.rewatchCount ?? 0})</Button>}
            {!isWatched && (
              <Button
                variant={inWatchlist ? "default" : "secondary"}
                onClick={onWatchlist}
                className="h-10"
                disabled={stateLoading || watchlistToggle.isPending}
              >
                {inWatchlist ? <Check className="w-4 h-4 mr-2" /> : <ListPlus className="w-4 h-4 mr-2" />}
                {inWatchlist ? "In watchlist" : "Add to watchlist"}
              </Button>
            )}
            {trailer && (
              <Button
                variant="outline"
                className="h-10"
                onClick={() => window.open(`https://www.youtube.com/watch?v=${trailer.key}`, "_blank")}
              >
                <Play className="w-4 h-4 mr-2 fill-current" /> Trailer
              </Button>
            )}
          </div>
            );
          })()}

          {/* Rating */}
          <Card className="rounded-2xl border-white/15 bg-black/25 p-5 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)] backdrop-blur-md">
            <div className="flex items-center justify-between gap-4 flex-wrap">
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
                    <span className="text-xs text-muted-foreground">Not rated yet</span>
                  </div>
                )}
              </div>
              {isWatched && <div className="flex items-center gap-2">
                {myRating != null && (
                  <Button variant="outline" size="sm" onClick={onRemoveRating}>
                    Remove rating
                  </Button>
                )}
                <Button size="sm" onClick={() => setRatingOpen(true)}>
                  <Star className="w-4 h-4 mr-1 fill-current" />
                  {myRating != null ? "Re-rate" : "Rate out of 100"}
                </Button>
              </div>}
              <div className="text-right">
                <p className="text-xs text-muted-foreground mb-1">TMDB score</p>
                <div className="flex items-center gap-1 text-amber-400 font-bold text-lg">
                  <Star className="w-5 h-5 fill-amber-400" />
                  {m.vote_average.toFixed(1)}
                  <span className="text-xs text-muted-foreground font-normal">/10 ({m.vote_count.toLocaleString()})</span>
                </div>
              </div>
            </div>
          </Card>

          {/* Genres */}
          <div className="flex flex-wrap gap-2.5 [&>*]:rounded-xl [&>*]:px-4 [&>*]:py-2">
            {m.genres?.map((g) => (
              <Badge key={g.id} variant="outline" className="border-primary/30 text-primary/90">{g.name}</Badge>
            ))}
          </div>
        </div>
      </div>
      </section>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="flex h-14 w-full justify-stretch overflow-x-auto rounded-2xl border border-white/10 bg-[#0a1220]/90 p-1.5 shadow-lg no-scrollbar [&>*]:h-full [&>*]:min-w-[120px] [&>*]:flex-1 [&>*]:rounded-xl">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="cast">Cast</TabsTrigger>
          {m.budget > 0 && <TabsTrigger value="details">Details</TabsTrigger>}
          {trailer && <TabsTrigger value="videos">Videos</TabsTrigger>}
        </TabsList>

        <TabsContent value="overview" className="space-y-4 mt-4">
          <div>
            <h3 className="text-lg font-bold mb-2">Synopsis</h3>
            <p className="text-foreground/80 leading-relaxed">{m.overview || "No overview available."}</p>
          </div>
          <WatchProviders providersData={(m as any)["watch/providers"]} />
          {recommendations.length > 0 && (
            <MediaRow title="Recommendations" icon={<Sparkles className="w-5 h-5" />} items={recommendations} forcedMediaType="movie" />
          )}
          {similar.length > 0 && (
            <MediaRow title="More like this" icon={<Heart className="w-5 h-5" />} items={similar} forcedMediaType="movie" />
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
                      <SafeImage src={img(c.profile_path, "w92")} alt={c.name} fill variant="profile" className="transition-opacity duration-200 group-hover:opacity-90" />
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

        {m.budget > 0 && (
          <TabsContent value="details" className="mt-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <DetailCard icon={<DollarSign className="w-5 h-5 text-emerald-400" />} label="Budget" value={`$${m.budget.toLocaleString()}`} />
              <DetailCard icon={<DollarSign className="w-5 h-5 text-emerald-400" />} label="Revenue" value={`$${m.revenue.toLocaleString()}`} />
              <DetailCard icon={<Calendar className="w-5 h-5 text-primary" />} label="Release date" value={releaseDate?.full || "—"} />
              <DetailCard icon={<Clock className="w-5 h-5 text-primary" />} label="Runtime" value={runtime || "—"} />
              <DetailCard icon={<Film className="w-5 h-5 text-primary" />} label="Status" value={m.status || "—"} />
              <DetailCard icon={<Users className="w-5 h-5 text-primary" />} label="Language" value={m.spoken_languages?.map((l) => l.english_name).join(", ") || "—"} />
            </div>
            {m.production_companies?.length > 0 && (
              <div className="mt-4">
                <h4 className="text-sm font-bold mb-2">Production</h4>
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
        open={isWatched && ratingOpen}
        onOpenChange={setRatingOpen}
        title={m.title || ""}
        poster={m.poster_path ? img(m.poster_path, "w185") : null}
        onRate={onRateSubmit}
        initialRating={myRating ?? null}
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
