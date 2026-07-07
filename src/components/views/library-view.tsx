"use client";

import { useState, useMemo } from "react";
import { useNav, type LibraryTab } from "@/lib/store";
import { useWatchlist, useWatchedMovies, useFollowing, useRatings, useTvDetail, useWatchedEpisodes, type WatchlistItemDB, type WatchedMovieDB, type FollowingShowDB, type RatingDB } from "@/hooks/use-tmdb";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { BookOpen, Film, Bell, Star, Trash2, Play, Tv, Inbox, ArrowUpDown } from "lucide-react";
import { img } from "@/lib/tmdb";
import { useWatchlistToggle, useWatchedMovieToggle, useFollowingToggle, useRatingMutate } from "@/hooks/use-tmdb";
import { toast } from "sonner";
import { motion } from "framer-motion";
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

function SortControl<T extends string>({ sortBy, onSortChange, count, label }: { sortBy: T; onSortChange: (v: T) => void; count: number; label: string }) {
  const options: { value: T; label: string }[] = [
    { value: "recent" as T, label: "Most Recent" },
    { value: "rating" as T, label: "Top Rated" },
    { value: "title" as T, label: "A-Z" },
    { value: "year" as T, label: "Newest First" },
  ];
  return (
    <div className="flex items-center justify-between gap-3 flex-wrap">
      <p className="text-sm text-muted-foreground">
        <span className="font-bold text-foreground">{count}</span> {label}
      </p>
      <div className="flex items-center gap-1 bg-muted/40 rounded-lg p-1">
        <ArrowUpDown className="w-3.5 h-3.5 text-muted-foreground ml-1.5" />
        {options.map((opt) => (
          <button
            key={opt.value}
            onClick={() => onSortChange(opt.value)}
            className={`px-2.5 py-1 rounded-md text-xs font-medium transition-colors ${
              sortBy === opt.value ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
            }`}
          >
            {opt.label}
          </button>
        ))}
      </div>
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
  const [sortBy, setSortBy] = useState<"recent" | "rating" | "title" | "year">("recent");

  const rawItems = data.data?.items ?? [];

  const items = useMemo(() => {
    const sorted = [...rawItems];
    switch (sortBy) {
      case "recent":
        return sorted.sort((a, b) => new Date(b.addedAt).getTime() - new Date(a.addedAt).getTime());
      case "rating":
        return sorted.sort((a, b) => (b.voteAverage || 0) - (a.voteAverage || 0));
      case "title":
        return sorted.sort((a, b) => a.title.localeCompare(b.title));
      case "year":
        return sorted.sort((a, b) => (b.releaseDate || "").localeCompare(a.releaseDate || ""));
      default:
        return sorted;
    }
  }, [rawItems, sortBy]);

  if (data.isLoading) return <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">{Array.from({ length: 4 }).map((_, i) => <div key={i} className="h-48 shimmer rounded-lg" />)}</div>;
  if (rawItems.length === 0) return <EmptyState icon={<Inbox className="w-8 h-8" />} title="Your watchlist is empty" subtitle="Add movies and shows you want to watch later" ctaLabel="Discover content" onCta={() => setView("discover")} />;

  return (
    <div className="space-y-3">
      <SortControl sortBy={sortBy} onSortChange={setSortBy} count={rawItems.length} label="items" />
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {items.map((item: WatchlistItemDB) => (
          <WatchlistCard key={item.id} item={item} onGo={() => item.mediaType === "movie" ? goMovie(item.tmdbId) : goTv(item.tmdbId)} onRemove={() => { toggle.mutate({ action: "remove", mediaType: item.mediaType as any, tmdbId: item.tmdbId, title: item.title }); toast.success("Removed from watchlist"); }} />
        ))}
      </div>
    </div>
  );
}

function WatchlistCard({ item, onGo, onRemove }: { item: WatchlistItemDB; onGo: () => void; onRemove: () => void }) {
  const isNew = Date.now() - new Date(item.addedAt).getTime() < 24 * 60 * 60 * 1000;
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2 }}
    >
      <Card className="p-3 flex gap-3 group hover:border-primary/40 hover:shadow-lg hover:shadow-primary/5 transition-all">
        <button
          className="w-16 h-24 rounded-md overflow-hidden bg-muted flex-shrink-0"
          onClick={onGo}
        >
          {item.posterPath ? (
            <img src={img(item.posterPath, "w185")} alt={item.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform" loading="lazy" />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-muted-foreground"><Film className="w-5 h-5" /></div>
          )}
        </button>
        <div className="flex-1 min-w-0 flex flex-col">
          <button onClick={onGo} className="text-left">
            <h4 className="font-semibold text-sm line-clamp-2 group-hover:text-primary transition-colors">{item.title}</h4>
          </button>
          <div className="flex items-center gap-1 mt-1 flex-wrap">
            <Badge variant="secondary" className="text-[10px]">
              {item.mediaType === "movie" ? <><Film className="w-2.5 h-2.5 mr-1" />Movie</> : <><Tv className="w-2.5 h-2.5 mr-1" />TV</>}
            </Badge>
            {item.releaseDate && <span className="text-xs text-muted-foreground">{item.releaseDate.slice(0, 4)}</span>}
            {item.voteAverage ? <span className="text-xs text-amber-400 flex items-center gap-0.5"><Star className="w-2.5 h-2.5 fill-amber-400" />{item.voteAverage.toFixed(1)}</span> : null}
            {isNew && <Badge className="text-[9px] h-5 px-1.5 bg-emerald-500/20 text-emerald-400 border-0">NEW</Badge>}
          </div>
          <p className="text-xs text-muted-foreground/80 line-clamp-2 mt-1 flex-1">{item.overview}</p>
          <div className="flex items-center justify-between mt-2">
              <span className="text-[10px] text-muted-foreground">Added {new Date(item.addedAt).toLocaleDateString()}</span>
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7 text-muted-foreground hover:text-destructive"
                onClick={onRemove}
                aria-label="Remove from watchlist"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </Button>
            </div>
          </div>
      </Card>
    </motion.div>
  );
}

function WatchedMoviesTab() {
  const data = useWatchedMovies();
  const goMovie = useNav((s) => s.goMovie);
  const toggle = useWatchedMovieToggle();
  const setView = useNav((s) => s.setView);
  const [sortBy, setSortBy] = useState<"recent" | "title" | "runtime">("recent");

  const rawItems = data.data?.items ?? [];

  const items = useMemo(() => {
    const sorted = [...rawItems];
    switch (sortBy) {
      case "recent":
        return sorted.sort((a, b) => new Date(b.watchedAt).getTime() - new Date(a.watchedAt).getTime());
      case "title":
        return sorted.sort((a, b) => a.title.localeCompare(b.title));
      case "runtime":
        return sorted.sort((a, b) => (b.runtime || 0) - (a.runtime || 0));
      default:
        return sorted;
    }
  }, [rawItems, sortBy]);

  if (data.isLoading) return <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">{Array.from({ length: 4 }).map((_, i) => <div key={i} className="h-48 shimmer rounded-lg" />)}</div>;
  if (rawItems.length === 0) return <EmptyState icon={<Film className="w-8 h-8" />} title="No watched movies yet" subtitle="Mark movies as watched to see them here" ctaLabel="Browse movies" onCta={() => setView("discover")} />;

  const sortOptions = [
    { value: "recent" as const, label: "Most Recent" },
    { value: "title" as const, label: "A-Z" },
    { value: "runtime" as const, label: "Longest" },
  ];

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <p className="text-sm text-muted-foreground">
          <span className="font-bold text-foreground">{rawItems.length}</span> movies
        </p>
        <div className="flex items-center gap-1 bg-muted/40 rounded-lg p-1">
          <ArrowUpDown className="w-3.5 h-3.5 text-muted-foreground ml-1.5" />
          {sortOptions.map((opt) => (
            <button
              key={opt.value}
              onClick={() => setSortBy(opt.value)}
              className={`px-2.5 py-1 rounded-md text-xs font-medium transition-colors ${
                sortBy === opt.value ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {items.map((item: WatchedMovieDB) => (
          <motion.div
            key={item.id}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.2 }}
          >
            <Card className="p-3 flex gap-3 group hover:border-primary/40 hover:shadow-lg hover:shadow-primary/5 transition-all">
              <button
                className="w-16 h-24 rounded-md overflow-hidden bg-muted flex-shrink-0"
                onClick={() => goMovie(item.tmdbId)}
              >
                {item.posterPath ? (
                  <img src={img(item.posterPath, "w185")} alt={item.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform" loading="lazy" />
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
          </motion.div>
        ))}
      </div>
    </div>
  );
}

function FollowingTab() {
  const data = useFollowing();
  const goTv = useNav((s) => s.goTv);
  const setView = useNav((s) => s.setView);
  const toggle = useFollowingToggle();
  const [sortBy, setSortBy] = useState<"recent" | "title">("recent");

  const rawItems = data.data?.items ?? [];

  const items = useMemo(() => {
    const sorted = [...rawItems];
    switch (sortBy) {
      case "recent":
        return sorted.sort((a, b) => new Date(b.followedAt).getTime() - new Date(a.followedAt).getTime());
      case "title":
        return sorted.sort((a, b) => a.title.localeCompare(b.title));
      default:
        return sorted;
    }
  }, [rawItems, sortBy]);

  if (data.isLoading) return <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">{Array.from({ length: 4 }).map((_, i) => <div key={i} className="h-48 shimmer rounded-lg" />)}</div>;
  if (rawItems.length === 0) return <EmptyState icon={<Bell className="w-8 h-8" />} title="Not following any shows" subtitle="Follow TV shows to track their episodes" ctaLabel="Discover shows" onCta={() => setView("discover")} />;

  const sortOptions = [
    { value: "recent" as const, label: "Most Recent" },
    { value: "title" as const, label: "A-Z" },
  ];

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <p className="text-sm text-muted-foreground">
          <span className="font-bold text-foreground">{rawItems.length}</span> shows
        </p>
        <div className="flex items-center gap-1 bg-muted/40 rounded-lg p-1">
          <ArrowUpDown className="w-3.5 h-3.5 text-muted-foreground ml-1.5" />
          {sortOptions.map((opt) => (
            <button
              key={opt.value}
              onClick={() => setSortBy(opt.value)}
              className={`px-2.5 py-1 rounded-md text-xs font-medium transition-colors ${
                sortBy === opt.value ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {items.map((item: FollowingShowDB) => (
          <FollowingCard key={item.id} item={item} onGo={() => goTv(item.tmdbId)} onUnfollow={() => { toggle.mutate({ action: "remove", tmdbId: item.tmdbId, title: item.title }); toast.success("Unfollowed"); }} />
        ))}
      </div>
    </div>
  );
}

function RatingsTab() {
  const data = useRatings();
  const goMovie = useNav((s) => s.goMovie);
  const goTv = useNav((s) => s.goTv);
  const setView = useNav((s) => s.setView);
  const toggle = useRatingMutate();
  const [sortBy, setSortBy] = useState<"recent" | "rating" | "title">("recent");

  const rawItems = data.data?.items ?? [];

  const items = useMemo(() => {
    const sorted = [...rawItems];
    switch (sortBy) {
      case "recent":
        return sorted.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
      case "rating":
        return sorted.sort((a, b) => b.value - a.value);
      case "title":
        return sorted.sort((a, b) => a.title.localeCompare(b.title));
      default:
        return sorted;
    }
  }, [rawItems, sortBy]);

  if (data.isLoading) return <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">{Array.from({ length: 4 }).map((_, i) => <div key={i} className="h-48 shimmer rounded-lg" />)}</div>;
  if (rawItems.length === 0) return <EmptyState icon={<Star className="w-8 h-8" />} title="No ratings yet" subtitle="Rate movies and shows to see them here" ctaLabel="Find something to rate" onCta={() => setView("discover")} />;

  const sortOptions = [
    { value: "recent" as const, label: "Most Recent" },
    { value: "rating" as const, label: "Highest Rated" },
    { value: "title" as const, label: "A-Z" },
  ];

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <p className="text-sm text-muted-foreground">
          <span className="font-bold text-foreground">{rawItems.length}</span> ratings
        </p>
        <div className="flex items-center gap-1 bg-muted/40 rounded-lg p-1">
          <ArrowUpDown className="w-3.5 h-3.5 text-muted-foreground ml-1.5" />
          {sortOptions.map((opt) => (
            <button
              key={opt.value}
              onClick={() => setSortBy(opt.value)}
              className={`px-2.5 py-1 rounded-md text-xs font-medium transition-colors ${
                sortBy === opt.value ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>
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

function FollowingCard({ item, onGo, onUnfollow }: { item: FollowingShowDB; onGo: () => void; onUnfollow: () => void }) {
  const detail = useTvDetail(item.tmdbId);
  const watched = useWatchedEpisodes(item.tmdbId);
  const totalEpisodes = detail.data?.number_of_episodes ?? 0;
  const watchedCount = watched.data?.items.length ?? 0;
  const progress = totalEpisodes > 0 ? Math.round((watchedCount / totalEpisodes) * 100) : 0;
  const status = detail.data?.status;
  const seasons = detail.data?.number_of_seasons;

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2 }}
    >
      <Card className="p-3 flex gap-3 group hover:border-primary/40 hover:shadow-lg hover:shadow-primary/5 transition-all">
        <button
          className="w-16 h-24 rounded-md overflow-hidden bg-muted flex-shrink-0"
          onClick={onGo}
        >
          {item.posterPath ? (
            <img src={img(item.posterPath, "w185")} alt={item.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform" loading="lazy" />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-muted-foreground"><Tv className="w-5 h-5" /></div>
          )}
        </button>
        <div className="flex-1 min-w-0 flex flex-col">
          <button onClick={onGo} className="text-left">
            <h4 className="font-semibold text-sm line-clamp-2 group-hover:text-primary transition-colors">{item.title}</h4>
          </button>
          <div className="flex items-center gap-1 mt-1 flex-wrap">
            <Badge variant="secondary" className="text-[10px] bg-amber-500/15 text-amber-400"><Bell className="w-2.5 h-2.5 mr-1" />Following</Badge>
            {seasons != null && seasons > 0 && (
              <Badge variant="secondary" className="text-[10px]">{seasons} season{seasons > 1 ? "s" : ""}</Badge>
            )}
            {status && <Badge variant="secondary" className="text-[10px]">{status}</Badge>}
          </div>

          {/* Watch progress */}
          {totalEpisodes > 0 && (
            <div className="mt-2">
              <div className="flex items-center justify-between text-[10px] text-muted-foreground mb-0.5">
                <span>{watchedCount} / {totalEpisodes} episodes</span>
                <span className="font-bold text-primary">{progress}%</span>
              </div>
              <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                <div className="h-full bg-gradient-to-r from-primary to-purple-500 transition-all duration-500" style={{ width: `${progress}%` }} />
              </div>
            </div>
          )}

          <p className="text-[10px] text-muted-foreground mt-auto pt-2">Followed {new Date(item.followedAt).toLocaleDateString()}</p>
          <div className="flex gap-1">
            <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={onGo}>
              <Play className="w-3.5 h-3.5 mr-1" /> Track
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="h-7 text-xs text-muted-foreground hover:text-destructive"
              onClick={onUnfollow}
            >
              <Trash2 className="w-3.5 h-3.5 mr-1" /> Unfollow
            </Button>
          </div>
        </div>
      </Card>
    </motion.div>
  );
}
