"use client";

import { useState, useMemo, useEffect } from "react";
import { useAppStore } from "@/lib/store";
import { cn } from "@/lib/utils";
import { pickGradient } from "@/lib/mock-data";
import { MediaCard, EmptyState } from "./shared";
import type { MediaType, MediaItem } from "@/lib/types";
import {
  Search,
  X,
  SlidersHorizontal,
  Star,
  Clock,
  TrendingUp,
  Calendar,
  Heart,
  Eye,
  Sparkles,
} from "lucide-react";

const TYPE_OPTIONS: { key: MediaType; label: string }[] = [
  { key: "movie", label: "أفلام" },
  { key: "tv", label: "مسلسلات" },
  { key: "anime", label: "أنمي" },
  { key: "arabic_movie", label: "أفلام عربية" },
  { key: "arabic_tv", label: "مسلسلات عربية" },
];

const ALL_GENRES = [
  "Action", "Adventure", "Animation", "Comedy", "Crime", "Documentary",
  "Drama", "Family", "Fantasy", "History", "Horror", "Music", "Mystery",
  "Romance", "Science Fiction", "Thriller", "War", "Western",
  "دراما", "كوميديا", "تشويق", "تاريخي", "اجتماعي", "رومانسي", "بوليسي",
];

const SORT_OPTIONS = [
  { value: "relevance", label: "الأكثر صلة" },
  { value: "popularity", label: "الأكثر شعبية" },
  { value: "rating", label: "الأعلى تقييمًا" },
  { value: "newest", label: "الأحدث" },
  { value: "oldest", label: "الأقدم" },
];

const RECENT_SEARCHES_KEY = "tvtime_recent_searches";

export function SearchView() {
  const { media, searchFilters, setSearchFilters, resetSearchFilters } = useAppStore();
  const [showFilters, setShowFilters] = useState(false);
  const [recentSearches, setRecentSearches] = useState<string[]>([]);
  const [debouncedQuery, setDebouncedQuery] = useState(searchFilters.query);

  // Load recent searches from localStorage
  useEffect(() => {
    try {
      const stored = localStorage.getItem(RECENT_SEARCHES_KEY);
      if (stored) setRecentSearches(JSON.parse(stored));
    } catch {}
  }, []);

  // Debounce query
  useEffect(() => {
    const t = setTimeout(() => setDebouncedQuery(searchFilters.query), 250);
    return () => clearTimeout(t);
  }, [searchFilters.query]);

  // Save recent searches
  useEffect(() => {
    if (debouncedQuery.trim().length >= 3) {
      setRecentSearches((prev) => {
        const next = [debouncedQuery, ...prev.filter((s) => s !== debouncedQuery)].slice(0, 8);
        try {
          localStorage.setItem(RECENT_SEARCHES_KEY, JSON.stringify(next));
        } catch {}
        return next;
      });
    }
  }, [debouncedQuery]);

  // Apply filters
  const results = useMemo(() => {
    let items: MediaItem[] = [...media];

    // Query filter
    if (debouncedQuery.trim()) {
      const q = debouncedQuery.toLowerCase().trim();
      items = items.filter(
        (m) =>
          m.title.toLowerCase().includes(q) ||
          m.genres.some((g) => g.toLowerCase().includes(q)) ||
          (m.overview?.toLowerCase().includes(q) ?? false)
      );
    }

    // Type filter (multi-select)
    if (searchFilters.types.length > 0) {
      items = items.filter((m) => searchFilters.types.includes(m.mediaType));
    }

    // Genre filter (multi-select)
    if (searchFilters.genres.length > 0) {
      items = items.filter((m) => m.genres.some((g) => searchFilters.genres.includes(g)));
    }

    // Year range
    if (searchFilters.yearFrom) {
      items = items.filter((m) => {
        const y = m.releaseDate ? new Date(m.releaseDate).getFullYear() : 0;
        return y >= searchFilters.yearFrom!;
      });
    }
    if (searchFilters.yearTo) {
      items = items.filter((m) => {
        const y = m.releaseDate ? new Date(m.releaseDate).getFullYear() : 0;
        return y <= searchFilters.yearTo!;
      });
    }

    // Rating range
    if (searchFilters.ratingFrom !== undefined) {
      items = items.filter((m) => (m.voteAverage || 0) >= searchFilters.ratingFrom!);
    }
    if (searchFilters.ratingTo !== undefined) {
      items = items.filter((m) => (m.voteAverage || 0) <= searchFilters.ratingTo!);
    }

    // Status filter (library status)
    if (searchFilters.status) {
      items = items.filter((m) => m.status === searchFilters.status);
    }

    // In library only
    if (searchFilters.inLibraryOnly) {
      items = items.filter((m) => m.status !== "plan_to_watch" && m.status !== "watchlist");
    }

    // Sort
    items.sort((a, b) => {
      switch (searchFilters.sortBy) {
        case "popularity":
          return (b.voteCount || 0) - (a.voteCount || 0);
        case "rating":
          return (b.voteAverage || 0) - (a.voteAverage || 0);
        case "newest":
          return new Date(b.releaseDate || "1900").getTime() - new Date(a.releaseDate || "1900").getTime();
        case "oldest":
          return new Date(a.releaseDate || "2100").getTime() - new Date(b.releaseDate || "2100").getTime();
        case "relevance":
        default:
          // If there's a query, items that contain query in title get priority
          if (debouncedQuery.trim()) {
            const q = debouncedQuery.toLowerCase().trim();
            const aTitle = a.title.toLowerCase().includes(q) ? 1 : 0;
            const bTitle = b.title.toLowerCase().includes(q) ? 1 : 0;
            if (bTitle !== aTitle) return bTitle - aTitle;
          }
          return (b.voteAverage || 0) - (a.voteAverage || 0);
      }
    });

    return items;
  }, [media, debouncedQuery, searchFilters]);

  const hasActiveFilters =
    searchFilters.genres.length > 0 ||
    searchFilters.types.length < TYPE_OPTIONS.length ||
    searchFilters.yearFrom ||
    searchFilters.yearTo ||
    searchFilters.ratingFrom !== undefined ||
    searchFilters.ratingTo !== undefined ||
    searchFilters.status ||
    searchFilters.inLibraryOnly ||
    searchFilters.sortBy !== "relevance";

  // Quick suggestions while typing
  const suggestions = useMemo(() => {
    if (!debouncedQuery.trim() || debouncedQuery.length < 2) return [];
    const q = debouncedQuery.toLowerCase().trim();
    return media
      .filter((m) => m.title.toLowerCase().includes(q))
      .slice(0, 5);
  }, [media, debouncedQuery]);

  return (
    <div className="space-y-4 pb-4">
      <h1 className="text-2xl font-bold">بحث</h1>

      {/* Search input */}
      <div className="relative">
        <Search size={18} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
        <input
          type="text"
          value={searchFilters.query}
          onChange={(e) => setSearchFilters({ query: e.target.value })}
          placeholder="ابحث عن فيلم، مسلسل، أنمي، أو شخص..."
          className="w-full pr-10 pl-10 py-3 bg-card border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary"
        />
        {searchFilters.query && (
          <button
            onClick={() => setSearchFilters({ query: "" })}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
          >
            <X size={16} />
          </button>
        )}
        <button
          onClick={() => setShowFilters(!showFilters)}
          className={cn(
            "absolute left-10 top-1/2 -translate-y-1/2",
            hasActiveFilters ? "text-primary" : "text-muted-foreground hover:text-foreground"
          )}
        >
          <SlidersHorizontal size={16} />
        </button>
      </div>

      {/* Suggestions dropdown while typing */}
      {searchFilters.query && suggestions.length > 0 && (
        <div className="bg-card border border-border rounded-lg overflow-hidden">
          {suggestions.map((m) => (
            <button
              key={m.id}
              onClick={() => setSearchFilters({ query: m.title })}
              className="w-full flex items-center gap-3 p-2.5 hover:bg-accent text-right"
            >
              <div className={cn("w-8 h-10 rounded bg-gradient-to-br shrink-0", pickGradient(m.tmdbId))} />
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium truncate">{m.title}</div>
                <div className="text-xs text-muted-foreground">
                  {TYPE_OPTIONS.find((t) => t.key === m.mediaType)?.label} • {m.releaseDate?.slice(0, 4)}
                </div>
              </div>
            </button>
          ))}
        </div>
      )}

      {/* Quick type tabs */}
      <div className="flex items-center gap-1 overflow-x-auto no-scrollbar">
        <button
          onClick={() => setSearchFilters({ types: TYPE_OPTIONS.map((t) => t.key) })}
          className={cn(
            "px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap",
            searchFilters.types.length === TYPE_OPTIONS.length
              ? "bg-primary text-primary-foreground"
              : "bg-card border border-border"
          )}
        >
          الكل
        </button>
        {TYPE_OPTIONS.map((t) => {
          const isActive = searchFilters.types.length === 1 && searchFilters.types[0] === t.key;
          const isPartial = searchFilters.types.includes(t.key) && searchFilters.types.length > 1 && searchFilters.types.length < TYPE_OPTIONS.length;
          return (
            <button
              key={t.key}
              onClick={() => {
                if (isActive) {
                  setSearchFilters({ types: TYPE_OPTIONS.map((tt) => tt.key) });
                } else {
                  setSearchFilters({ types: [t.key] });
                }
              }}
              className={cn(
                "px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap",
                isActive
                  ? "bg-primary text-primary-foreground"
                  : isPartial
                  ? "bg-primary/10 text-primary border border-primary/30"
                  : "bg-card border border-border"
              )}
            >
              {t.label}
            </button>
          );
        })}
      </div>

      {/* Recent searches (when query is empty) */}
      {!searchFilters.query && recentSearches.length > 0 && (
        <section>
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-sm font-medium text-muted-foreground">عمليات بحث سابقة</h3>
            <button
              onClick={() => {
                setRecentSearches([]);
                try { localStorage.removeItem(RECENT_SEARCHES_KEY); } catch {}
              }}
              className="text-xs text-muted-foreground hover:text-foreground"
            >
              مسح
            </button>
          </div>
          <div className="flex flex-wrap gap-2">
            {recentSearches.map((s) => (
              <button
                key={s}
                onClick={() => setSearchFilters({ query: s })}
                className="px-3 py-1.5 rounded-full text-xs bg-card border border-border hover:bg-accent"
              >
                {s}
              </button>
            ))}
          </div>
        </section>
      )}

      {/* Advanced filters panel */}
      {showFilters && (
        <div className="bg-card border border-border rounded-lg p-4 space-y-4">
          {/* Genres */}
          <div>
            <h4 className="text-xs font-medium text-muted-foreground mb-2">الأنواع</h4>
            <div className="flex flex-wrap gap-1.5">
              {ALL_GENRES.map((g) => {
                const isSelected = searchFilters.genres.includes(g);
                return (
                  <button
                    key={g}
                    onClick={() => {
                      setSearchFilters({
                        genres: isSelected
                          ? searchFilters.genres.filter((x) => x !== g)
                          : [...searchFilters.genres, g],
                      });
                    }}
                    className={cn(
                      "px-2.5 py-1 rounded-full text-xs font-medium",
                      isSelected ? "bg-primary text-primary-foreground" : "bg-accent hover:bg-accent/70"
                    )}
                  >
                    {g}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Year range */}
          <div>
            <h4 className="text-xs font-medium text-muted-foreground mb-2">سنة الإصدار</h4>
            <div className="flex items-center gap-2">
              <input
                type="number"
                placeholder="من"
                value={searchFilters.yearFrom || ""}
                onChange={(e) => setSearchFilters({ yearFrom: e.target.value ? parseInt(e.target.value) : undefined })}
                className="w-24 px-2 py-1.5 text-sm bg-background border border-border rounded-md"
              />
              <span className="text-muted-foreground">—</span>
              <input
                type="number"
                placeholder="إلى"
                value={searchFilters.yearTo || ""}
                onChange={(e) => setSearchFilters({ yearTo: e.target.value ? parseInt(e.target.value) : undefined })}
                className="w-24 px-2 py-1.5 text-sm bg-background border border-border rounded-md"
              />
            </div>
          </div>

          {/* Rating range */}
          <div>
            <h4 className="text-xs font-medium text-muted-foreground mb-2">التقييم (TMDB)</h4>
            <div className="flex items-center gap-2">
              <input
                type="number"
                min="0"
                max="10"
                step="0.5"
                placeholder="من"
                value={searchFilters.ratingFrom ?? ""}
                onChange={(e) => setSearchFilters({ ratingFrom: e.target.value ? parseFloat(e.target.value) : undefined })}
                className="w-24 px-2 py-1.5 text-sm bg-background border border-border rounded-md"
              />
              <span className="text-muted-foreground">—</span>
              <input
                type="number"
                min="0"
                max="10"
                step="0.5"
                placeholder="إلى"
                value={searchFilters.ratingTo ?? ""}
                onChange={(e) => setSearchFilters({ ratingTo: e.target.value ? parseFloat(e.target.value) : undefined })}
                className="w-24 px-2 py-1.5 text-sm bg-background border border-border rounded-md"
              />
            </div>
          </div>

          {/* Status filter (library) */}
          <div>
            <h4 className="text-xs font-medium text-muted-foreground mb-2">الحالة في مكتبتك</h4>
            <div className="flex flex-wrap gap-1.5">
              {[
                { value: undefined, label: "الكل" },
                { value: "watching" as const, label: "أشاهد الآن" },
                { value: "completed" as const, label: "مكتمل" },
                { value: "watchlist" as const, label: "قائمة المشاهدة" },
                { value: "on_hold" as const, label: "متوقف" },
                { value: "dropped" as const, label: "تخليت عنه" },
              ].map((s) => (
                <button
                  key={s.label}
                  onClick={() => setSearchFilters({ status: s.value })}
                  className={cn(
                    "px-2.5 py-1 rounded-full text-xs font-medium",
                    searchFilters.status === s.value
                      ? "bg-primary text-primary-foreground"
                      : "bg-accent hover:bg-accent/70"
                  )}
                >
                  {s.label}
                </button>
              ))}
            </div>
          </div>

          {/* Sort */}
          <div>
            <h4 className="text-xs font-medium text-muted-foreground mb-2">ترتيب حسب</h4>
            <select
              value={searchFilters.sortBy}
              onChange={(e) => setSearchFilters({ sortBy: e.target.value as any })}
              className="w-full px-2 py-1.5 text-sm bg-background border border-border rounded-md"
            >
              {SORT_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
          </div>

          {/* Reset */}
          {hasActiveFilters && (
            <button
              onClick={() => {
                resetSearchFilters();
                setSearchFilters({ query: searchFilters.query });
              }}
              className="text-xs text-rose-500 hover:text-rose-600 flex items-center gap-1"
            >
              <X size={12} /> إعادة ضبط الفلاتر
            </button>
          )}
        </div>
      )}

      {/* Results */}
      <section>
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-medium text-muted-foreground">
            {results.length} نتيجة
          </h3>
        </div>
        {results.length === 0 ? (
          <EmptyState
            title="لا توجد نتائج"
            hint="جرّب تغيير الفلاتر أو ابحث بكلمة أخرى"
            icon={<Search size={48} />}
          />
        ) : (
          <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 gap-3">
            {results.map((m) => (
              <MediaCard key={`${m.id}-${m.tmdbId}`} media={m} />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
