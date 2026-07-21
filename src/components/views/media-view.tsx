"use client";

import { useState, useMemo } from "react";
import { useMedia, useMediaStats, type MediaItemDB } from "@/hooks/use-tmdb";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { FilterField, FilterGrid, FilterPanel, FilterSection } from "@/components/ui/filter-panel";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Film, Tv, BookOpen, Gamepad2, Star, Check, Search, ArrowUpDown, Database } from "lucide-react";
import { motion } from "framer-motion";
import { SafeImage } from "@/components/media/safe-image";

const TYPE_CONFIG = {
  movie: { label: "Movies", icon: Film, color: "text-rose-400" },
  series: { label: "TV Shows", icon: Tv, color: "text-purple-400" },
  book: { label: "Books", icon: BookOpen, color: "text-amber-400" },
  game: { label: "Games", icon: Gamepad2, color: "text-emerald-400" },
} as const;

export function MediaView() {
  const [type, setType] = useState<string>("");
  const [search, setSearch] = useState("");
  const [sortBy, setSortBy] = useState("addedAt");
  const [statusFilter, setStatusFilter] = useState<string>("");
  const [showRatedOnly, setShowRatedOnly] = useState(false);
  const [page, setPage] = useState(0);
  const limit = 60;

  const debouncedSearch = useDebounce(search, 400);

  const media = useMedia({
    type: type || undefined,
    status: statusFilter || undefined,
    rated: showRatedOnly ? "true" : undefined,
    search: debouncedSearch || undefined,
    sortBy,
    order: "desc",
    limit,
    offset: page * limit,
  });

  const stats = useMediaStats();

  const items = media.data?.items ?? [];
  const total = media.data?.total ?? 0;
  const totalPages = Math.ceil(total / limit);

  return (
    <div className="tvtime-media-page space-y-5">
      {/* Header */}
      <div className="view-page-header flex items-center gap-3">
        <div className="w-12 h-12 rounded-xl bg-primary/15 flex items-center justify-center">
          <Database className="w-6 h-6 text-primary" />
        </div>
        <div>
          <h1 className="view-page-title text-2xl sm:text-3xl font-extrabold tracking-tight">My Media Collection</h1>
          <p className="view-page-description text-sm text-muted-foreground mt-0.5">
            {stats.data ? `${stats.data.counts.total} items` : "Loading..."} from your Neon database
          </p>
        </div>
      </div>

      {/* Stats overview */}
      {stats.data && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <StatCard icon={<Film className="w-5 h-5" />} label="Movies" value={stats.data.counts.movies} color="from-rose-500/20 to-rose-500/5" />
          <StatCard icon={<Tv className="w-5 h-5" />} label="TV Shows" value={stats.data.counts.series} color="from-purple-500/20 to-purple-500/5" />
          <StatCard icon={<BookOpen className="w-5 h-5" />} label="Books" value={stats.data.counts.books} color="from-amber-500/20 to-amber-500/5" />
          <StatCard icon={<Gamepad2 className="w-5 h-5" />} label="Games" value={stats.data.counts.games} color="from-emerald-500/20 to-emerald-500/5" />
        </div>
      )}

      {/* Filters */}
      <FilterPanel
        title="Collection filters"
        description="Filter by media type, search your collection, then refine the order and status."
        activeCount={
          Number(type !== "") +
          Number(search.trim() !== "") +
          Number(sortBy !== "addedAt") +
          Number(statusFilter !== "") +
          Number(showRatedOnly)
        }
      >
        <FilterSection title="Media type">
          <Tabs value={type} onValueChange={(v) => { setType(v === "all" ? "" : v); setPage(0); }}>
            <TabsList className="h-auto w-full justify-start overflow-x-auto no-scrollbar">
              <TabsTrigger value="all">All</TabsTrigger>
              <TabsTrigger value="movie"><Film className="mr-1.5 h-4 w-4" />Movies</TabsTrigger>
              <TabsTrigger value="series"><Tv className="mr-1.5 h-4 w-4" />TV</TabsTrigger>
              <TabsTrigger value="book"><BookOpen className="mr-1.5 h-4 w-4" />Books</TabsTrigger>
              <TabsTrigger value="game"><Gamepad2 className="mr-1.5 h-4 w-4" />Games</TabsTrigger>
            </TabsList>
          </Tabs>
        </FilterSection>

        <FilterSection title="Search and quick filters" divided>
          <FilterGrid className="lg:grid-cols-[minmax(0,1fr)_auto]">
            <FilterField label="Search collection">
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={search}
                  onChange={(e) => { setSearch(e.target.value); setPage(0); }}
                  placeholder="Search your collection..."
                  className="h-9 pl-9"
                />
              </div>
            </FilterField>

            <FilterField label="Rating">
              <Button
                variant={showRatedOnly ? "default" : "outline"}
                size="sm"
                className="h-9 whitespace-nowrap lg:min-w-32"
                onClick={() => { setShowRatedOnly(!showRatedOnly); setPage(0); }}
              >
                <Star className="mr-1.5 h-4 w-4" /> Rated only
              </Button>
            </FilterField>
          </FilterGrid>
        </FilterSection>

        <FilterSection title="Sort and status" divided>
          <FilterGrid className="lg:grid-cols-2">
            <FilterField label="Sort by">
              <div className="flex min-h-9 flex-wrap items-center gap-1 rounded-lg border border-border/50 bg-muted/25 p-1">
                <ArrowUpDown className="ml-1.5 h-3.5 w-3.5 text-muted-foreground" />
                {[
                  { v: "addedAt", l: "Recent" },
                  { v: "userRating", l: "Rating" },
                  { v: "title", l: "A-Z" },
                  { v: "year", l: "Year" },
                ].map((opt) => (
                  <button type="button"
                    data-ui-action="choice"
                    key={opt.v}
                    aria-pressed={sortBy === opt.v}
                    onClick={() => setSortBy(opt.v)}
                    className={`rounded-md px-2.5 py-1 text-xs font-medium transition-colors ${
                      sortBy === opt.v ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    {opt.l}
                  </button>
                ))}
              </div>
            </FilterField>

            <FilterField label="Status">
              <div className="flex min-h-9 flex-wrap items-center gap-1 rounded-lg border border-border/50 bg-muted/25 p-1">
                {[
                  { v: "", l: "All" },
                  { v: "planned", l: "Planned" },
                ].map((opt) => (
                  <button type="button"
                    data-ui-action="choice"
                    key={opt.v}
                    aria-pressed={statusFilter === opt.v}
                    onClick={() => { setStatusFilter(opt.v); setPage(0); }}
                    className={`rounded-md px-2.5 py-1 text-xs font-medium transition-colors ${
                      statusFilter === opt.v ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    {opt.l}
                  </button>
                ))}
              </div>
            </FilterField>
          </FilterGrid>
        </FilterSection>
      </FilterPanel>

      {/* Results count */}
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          Showing <span className="font-bold text-foreground">{items.length}</span> of <span className="font-bold text-foreground">{total}</span> items
        </p>
      </div>

      {/* Grid */}
      {media.isLoading ? (
        <div className="feedback-grid feedback-grid--loading grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3 sm:gap-4" role="status" aria-busy="true" aria-label="Loading collection">
          {Array.from({ length: 12 }).map((_, i) => (
            <div key={i} className="aspect-[2/3] shimmer rounded-lg" />
          ))}
        </div>
      ) : items.length === 0 ? (
        <Card className="feedback-state feedback-state--empty p-12 text-center text-muted-foreground" role="status">
          <Search className="w-12 h-12 mx-auto mb-3 opacity-40" />
          <p className="font-medium">No items found</p>
          <p className="text-sm mt-1">Try adjusting your filters or search</p>
        </Card>
      ) : (
        <div className="feedback-grid grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3 sm:gap-4">
          {items.map((item, i) => (
            <MediaCard key={item.id} item={item} index={i} />
          ))}
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2 pt-4">
          <Button variant="outline" size="sm" disabled={page === 0} onClick={() => setPage((p) => Math.max(0, p - 1))}>
            Prev
          </Button>
          <span className="text-sm text-muted-foreground px-3">
            Page <span className="font-bold text-foreground">{page + 1}</span> of {totalPages}
          </span>
          <Button variant="outline" size="sm" disabled={page >= totalPages - 1} onClick={() => setPage((p) => p + 1)}>
            Next
          </Button>
        </div>
      )}
    </div>
  );
}

function StatCard({ icon, label, value, color }: { icon: React.ReactNode; label: string; value: number; color: string }) {
  return (
    <Card className={`p-4 relative overflow-hidden bg-gradient-to-br ${color}`}>
      <div className="relative">
        <div className="w-9 h-9 rounded-lg bg-background/50 backdrop-blur flex items-center justify-center text-primary mb-2">{icon}</div>
        <p className="text-2xl sm:text-3xl font-extrabold">{value}</p>
        <p className="text-xs text-muted-foreground">{label}</p>
      </div>
    </Card>
  );
}

function MediaCard({ item, index }: { item: MediaItemDB; index: number }) {
  const cfg = TYPE_CONFIG[item.type as keyof typeof TYPE_CONFIG] || TYPE_CONFIG.movie;
  const Icon = cfg.icon;
  const userRating = item.userRating;
  const publicRating = item.rating ? parseFloat(item.rating) : null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay: Math.min(index * 0.02, 0.3) }}
    >
      <Card className="overflow-hidden p-0 border-border/50 hover:border-primary/55 transition-[border-color,box-shadow,background-color] duration-200 hover:shadow-lg hover:shadow-primary/10 bg-card group">
        <div className="relative aspect-[2/3] overflow-hidden bg-muted">
          {item.poster ? (
            <SafeImage src={item.poster} alt={item.title} loading="lazy" className="w-full h-full object-cover transition-opacity duration-200 group-hover:opacity-95" />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-muted-foreground">
              <Icon className="w-12 h-12" />
            </div>
          )}
          {/* gradient overlay */}
          <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/10 to-transparent opacity-80" />

          {/* type badge */}
          <div className="absolute top-2 left-2">
            <Badge variant="secondary" className={`bg-black/60 backdrop-blur border-0 text-[10px] h-6 px-2 ${cfg.color}`}>
              <Icon className="w-3 h-3 mr-1" />
              {item.type === "series" ? "TV" : item.type.charAt(0).toUpperCase() + item.type.slice(1)}
            </Badge>
          </div>

          {/* user rating badge */}
          {userRating != null && (
            <div className="absolute top-2 right-2">
              <Badge className="bg-amber-500/90 text-black border-0 text-[10px] h-6 px-2 font-bold">
                <Star className="w-3 h-3 mr-1 fill-black" />
                {userRating}
              </Badge>
            </div>
          )}

          {/* watched badge */}
          {item.watched && (
            <div className="absolute top-10 right-2">
              <span className="w-6 h-6 rounded-full bg-emerald-600/90 backdrop-blur flex items-center justify-center" title="Watched">
                <Check className="w-3.5 h-3.5 text-white" />
              </span>
            </div>
          )}

          {/* planned badge */}
          {item.status === "planned" && !item.watched && (
            <div className="absolute top-10 right-2">
              <Badge data-status="planned" className="bg-blue-500/90 text-white border-0 text-[9px] h-5 px-1.5">PLAN</Badge>
            </div>
          )}

          {/* bottom title overlay */}
          <div className="absolute bottom-0 left-0 right-0 p-3">
            <h3 className="font-semibold text-white text-sm line-clamp-2 leading-tight drop-shadow">{item.title}</h3>
            <div className="flex items-center gap-2 mt-0.5">
              {item.year && <p className="text-white/70 text-xs">{item.year}</p>}
              {publicRating != null && (
                <span className="text-amber-300 text-xs flex items-center gap-0.5">
                  <Star className="w-2.5 h-2.5 fill-amber-300" />
                  {publicRating.toFixed(1)}
                </span>
              )}
            </div>
          </div>
        </div>
      </Card>
    </motion.div>
  );
}

// Simple debounce hook
function useDebounce<T>(value: T, delay: number): T {
  const [debounced, setDebounced] = useState(value);
  useMemo(() => {
    const timer = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);
  return debounced;
}
