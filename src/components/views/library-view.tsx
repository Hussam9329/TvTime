"use client";

import { useNav, type LibraryTab } from "@/lib/store";
import { useWatchlist, useWatchedMovies, useFollowing, useRatings, type WatchlistItemDB, type WatchedMovieDB, type FollowingShowDB, type RatingDB } from "@/hooks/use-tmdb";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { BookOpen, Film, Bell, Star, Trash2, Play, Tv, Inbox } from "lucide-react";
import { img } from "@/lib/tmdb";
import { useWatchlistToggle, useWatchedMovieToggle, useFollowingToggle, useRatingMutate } from "@/hooks/use-tmdb";
import { toast } from "sonner";
import { RatingStars } from "@/components/media/rating-stars";

export function LibraryView() {
  const { libraryTab, setLibraryTab } = useNav();
  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight">My Library</h1>
        <p className="text-sm text-muted-foreground mt-1">Everything you've saved, watched, and rated</p>
      </div>

      <Tabs value={libraryTab} onValueChange={(v) => setLibraryTab(v as LibraryTab)}>
        <TabsList className="w-full justify-start overflow-x-auto no-scrollbar">
          <TabsTrigger value="watchlist"><BookOpen className="w-4 h-4 mr-1.5" />Watchlist</TabsTrigger>
          <TabsTrigger value="watched-movies"><Film className="w-4 h-4 mr-1.5" />Watched Movies</TabsTrigger>
          <TabsTrigger value="following"><Bell className="w-4 h-4 mr-1.5" />Following</TabsTrigger>
          <TabsTrigger value="ratings"><Star className="w-4 h-4 mr-1.5" />Ratings</TabsTrigger>
        </TabsList>

        <div className="mt-4">
          {libraryTab === "watchlist" && <WatchlistTab />}
          {libraryTab === "watched-movies" && <WatchedMoviesTab />}
          {libraryTab === "following" && <FollowingTab />}
          {libraryTab === "ratings" && <RatingsTab />}
        </div>
      </Tabs>
    </div>
  );
}

function EmptyState({ icon, title, subtitle, ctaLabel, onCta }: { icon: React.ReactNode; title: string; subtitle: string; ctaLabel?: string; onCta?: () => void }) {
  return (
    <Card className="p-12 text-center text-muted-foreground relative overflow-hidden">
      <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-purple-500/5 pointer-events-none" />
      <div className="relative">
        <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-primary/20 to-primary/5 mx-auto mb-4 flex items-center justify-center text-primary border border-primary/20">
          {icon}
        </div>
        <p className="font-semibold text-foreground text-lg">{title}</p>
        <p className="text-sm mt-1 max-w-sm mx-auto">{subtitle}</p>
        {ctaLabel && onCta && (
          <Button onClick={onCta} className="mt-4" size="sm">
            {ctaLabel}
          </Button>
        )}
      </div>
    </Card>
  );
}

function WatchlistTab() {
  const data = useWatchlist();
  const goMovie = useNav((s) => s.goMovie);
  const goTv = useNav((s) => s.goTv);
  const toggle = useWatchlistToggle();
  const setView = useNav((s) => s.setView);

  const items = data.data?.items ?? [];

  if (data.isLoading) return <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">{Array.from({ length: 4 }).map((_, i) => <div key={i} className="h-48 shimmer rounded-lg" />)}</div>;
  if (items.length === 0) return <EmptyState icon={<Inbox className="w-8 h-8" />} title="Your watchlist is empty" subtitle="Add movies and shows you want to watch later" ctaLabel="Discover content" onCta={() => setView("discover")} />;

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
      {items.map((item: WatchlistItemDB) => (
        <Card key={item.id} className="p-3 flex gap-3 group hover:border-primary/40 transition-colors">
          <button
            className="w-16 h-24 rounded-md overflow-hidden bg-muted flex-shrink-0"
            onClick={() => item.mediaType === "movie" ? goMovie(item.tmdbId) : goTv(item.tmdbId)}
          >
            {item.posterPath ? (
              <img src={img(item.posterPath, "w185")} alt={item.title} className="w-full h-full object-cover" loading="lazy" />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-muted-foreground"><Film className="w-5 h-5" /></div>
            )}
          </button>
          <div className="flex-1 min-w-0 flex flex-col">
            <button onClick={() => item.mediaType === "movie" ? goMovie(item.tmdbId) : goTv(item.tmdbId)} className="text-left">
              <h4 className="font-semibold text-sm line-clamp-2 group-hover:text-primary transition-colors">{item.title}</h4>
            </button>
            <div className="flex items-center gap-1 mt-1 flex-wrap">
              <Badge variant="secondary" className="text-[10px]">
                {item.mediaType === "movie" ? <><Film className="w-2.5 h-2.5 mr-1" />Movie</> : <><Tv className="w-2.5 h-2.5 mr-1" />TV</>}
              </Badge>
              {item.releaseDate && <span className="text-xs text-muted-foreground">{item.releaseDate.slice(0, 4)}</span>}
              {item.voteAverage ? <span className="text-xs text-amber-400 flex items-center gap-0.5"><Star className="w-2.5 h-2.5 fill-amber-400" />{item.voteAverage.toFixed(1)}</span> : null}
            </div>
            <p className="text-xs text-muted-foreground/80 line-clamp-2 mt-1 flex-1">{item.overview}</p>
            <div className="flex items-center justify-between mt-2">
              <span className="text-[10px] text-muted-foreground">Added {new Date(item.addedAt).toLocaleDateString()}</span>
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7 text-muted-foreground hover:text-destructive"
                onClick={() => { toggle.mutate({ action: "remove", mediaType: item.mediaType as any, tmdbId: item.tmdbId, title: item.title }); toast.success("Removed from watchlist"); }}
                aria-label="Remove from watchlist"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </Button>
            </div>
          </div>
        </Card>
      ))}
    </div>
  );
}

function WatchedMoviesTab() {
  const data = useWatchedMovies();
  const goMovie = useNav((s) => s.goMovie);
  const toggle = useWatchedMovieToggle();

  const items = data.data?.items ?? [];

  if (data.isLoading) return <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">{Array.from({ length: 4 }).map((_, i) => <div key={i} className="h-48 shimmer rounded-lg" />)}</div>;
  if (items.length === 0) return <EmptyState icon={<Film className="w-8 h-8" />} title="No watched movies yet" subtitle="Mark movies as watched to see them here" ctaLabel="Browse movies" onCta={() => setView("discover")} />;

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
      {items.map((item: WatchedMovieDB) => (
        <Card key={item.id} className="p-3 flex gap-3 group hover:border-primary/40 transition-colors">
          <button
            className="w-16 h-24 rounded-md overflow-hidden bg-muted flex-shrink-0"
            onClick={() => goMovie(item.tmdbId)}
          >
            {item.posterPath ? (
              <img src={img(item.posterPath, "w185")} alt={item.title} className="w-full h-full object-cover" loading="lazy" />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-muted-foreground"><Film className="w-5 h-5" /></div>
            )}
          </button>
          <div className="flex-1 min-w-0 flex flex-col">
            <button onClick={() => goMovie(item.tmdbId)} className="text-left">
              <h4 className="font-semibold text-sm line-clamp-2 group-hover:text-primary transition-colors">{item.title}</h4>
            </button>
            <div className="flex items-center gap-1 mt-1 flex-wrap">
              <Badge variant="secondary" className="text-[10px] bg-emerald-500/15 text-emerald-400"><Film className="w-2.5 h-2.5 mr-1" />Watched</Badge>
              {item.runtime ? <span className="text-xs text-muted-foreground">{Math.floor(item.runtime / 60)}h {item.runtime % 60}m</span> : null}
            </div>
            <p className="text-[10px] text-muted-foreground mt-auto pt-2">Watched {new Date(item.watchedAt).toLocaleDateString()}</p>
            <Button
              variant="ghost"
              size="sm"
              className="h-7 text-xs text-muted-foreground hover:text-destructive justify-start px-0"
              onClick={() => { toggle.mutate({ action: "remove", tmdbId: item.tmdbId, title: item.title }); toast.success("Removed from watched"); }}
            >
              <Trash2 className="w-3.5 h-3.5 mr-1" /> Remove
            </Button>
          </div>
        </Card>
      ))}
    </div>
  );
}

function FollowingTab() {
  const data = useFollowing();
  const goTv = useNav((s) => s.goTv);
  const setView = useNav((s) => s.setView);
  const toggle = useFollowingToggle();

  const items = data.data?.items ?? [];

  if (data.isLoading) return <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">{Array.from({ length: 4 }).map((_, i) => <div key={i} className="h-48 shimmer rounded-lg" />)}</div>;
  if (items.length === 0) return <EmptyState icon={<Bell className="w-8 h-8" />} title="Not following any shows" subtitle="Follow TV shows to track their episodes" ctaLabel="Discover shows" onCta={() => setView("discover")} />;

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
      {items.map((item: FollowingShowDB) => (
        <Card key={item.id} className="p-3 flex gap-3 group hover:border-primary/40 transition-colors">
          <button
            className="w-16 h-24 rounded-md overflow-hidden bg-muted flex-shrink-0"
            onClick={() => goTv(item.tmdbId)}
          >
            {item.posterPath ? (
              <img src={img(item.posterPath, "w185")} alt={item.title} className="w-full h-full object-cover" loading="lazy" />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-muted-foreground"><Tv className="w-5 h-5" /></div>
            )}
          </button>
          <div className="flex-1 min-w-0 flex flex-col">
            <button onClick={() => goTv(item.tmdbId)} className="text-left">
              <h4 className="font-semibold text-sm line-clamp-2 group-hover:text-primary transition-colors">{item.title}</h4>
            </button>
            <div className="flex items-center gap-1 mt-1 flex-wrap">
              <Badge variant="secondary" className="text-[10px] bg-amber-500/15 text-amber-400"><Bell className="w-2.5 h-2.5 mr-1" />Following</Badge>
            </div>
            <p className="text-[10px] text-muted-foreground mt-auto pt-2">Followed {new Date(item.followedAt).toLocaleDateString()}</p>
            <div className="flex gap-1">
              <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => goTv(item.tmdbId)}>
                <Play className="w-3.5 h-3.5 mr-1" /> Track
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="h-7 text-xs text-muted-foreground hover:text-destructive"
                onClick={() => { toggle.mutate({ action: "remove", tmdbId: item.tmdbId, title: item.title }); toast.success("Unfollowed"); }}
              >
                <Trash2 className="w-3.5 h-3.5 mr-1" /> Unfollow
              </Button>
            </div>
          </div>
        </Card>
      ))}
    </div>
  );
}

function RatingsTab() {
  const data = useRatings();
  const goMovie = useNav((s) => s.goMovie);
  const goTv = useNav((s) => s.goTv);
  const setView = useNav((s) => s.setView);
  const toggle = useRatingMutate();

  const items = data.data?.items ?? [];

  if (data.isLoading) return <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">{Array.from({ length: 4 }).map((_, i) => <div key={i} className="h-48 shimmer rounded-lg" />)}</div>;
  if (items.length === 0) return <EmptyState icon={<Star className="w-8 h-8" />} title="No ratings yet" subtitle="Rate movies and shows to see them here" ctaLabel="Find something to rate" onCta={() => setView("discover")} />;

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
      {items.map((item: RatingDB) => (
        <Card key={item.id} className="p-3 flex gap-3 group hover:border-primary/40 transition-colors">
          <button
            className="w-16 h-24 rounded-md overflow-hidden bg-muted flex-shrink-0"
            onClick={() => item.mediaType === "movie" ? goMovie(item.tmdbId) : goTv(item.tmdbId)}
          >
            {item.posterPath ? (
              <img src={img(item.posterPath, "w185")} alt={item.title} className="w-full h-full object-cover" loading="lazy" />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-muted-foreground">
                {item.mediaType === "movie" ? <Film className="w-5 h-5" /> : <Tv className="w-5 h-5" />}
              </div>
            )}
          </button>
          <div className="flex-1 min-w-0 flex flex-col">
            <button onClick={() => item.mediaType === "movie" ? goMovie(item.tmdbId) : goTv(item.tmdbId)} className="text-left">
              <h4 className="font-semibold text-sm line-clamp-2 group-hover:text-primary transition-colors">
                {item.title}
              </h4>
            </button>
            <div className="flex items-center gap-1 mt-1">
              <Badge variant="secondary" className="text-[10px]">
                {item.mediaType === "movie" ? <><Film className="w-2.5 h-2.5 mr-1" />Movie</> : <><Tv className="w-2.5 h-2.5 mr-1" />TV</>}
              </Badge>
            </div>
            <div className="mt-2">
              <RatingStars value={item.value} readOnly size="sm" showValue />
            </div>
            <p className="text-[10px] text-muted-foreground mt-2">Rated {new Date(item.updatedAt).toLocaleDateString()}</p>
            <Button
              variant="ghost"
              size="sm"
              className="h-7 text-xs text-muted-foreground hover:text-destructive justify-start px-0"
              onClick={() => { toggle.mutate({ action: "remove", mediaType: item.mediaType as any, tmdbId: item.tmdbId }); toast.success("Rating removed"); }}
            >
              <Trash2 className="w-3.5 h-3.5 mr-1" /> Remove rating
            </Button>
          </div>
        </Card>
      ))}
    </div>
  );
}
