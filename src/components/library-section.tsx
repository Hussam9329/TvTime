"use client";

import { useState, useMemo } from "react";
import type { MediaItem, MediaType, MediaStatus } from "@/lib/types";
import { useAppStore } from "@/lib/store";
import { cn } from "@/lib/utils";
import { pickGradient } from "@/lib/mock-data";
import { MediaCard, StatusCounter, SectionHeader, EmptyState, StatusBadge } from "./shared";
import {
  ListFilter,
  Calendar as CalendarIcon,
  Library as LibraryIcon,
  Compass,
  ChevronRight,
  Star,
  Clock,
  PlayCircle,
  CheckCircle2,
  AlertTriangle,
  X,
} from "lucide-react";

// ─────────────────────────────────────────────────────────────
// Types for the unified library section
// ─────────────────────────────────────────────────────────────

interface LibrarySectionConfig {
  mediaType: MediaType;
  title: string;
  arabicTitle: string;
  // Allow showing upcoming releases for movies
  hasSchedule: boolean;
  scheduleLabel: string;
  // Discover sources
  discoverItems: MediaItem[];
  // Upcoming schedule items (for TV: episodes; for movies: releases)
  upcomingItems?: { date: string; media: MediaItem; season?: number; episode?: number; name?: string }[];
}

type Tab = "library" | "discover" | "schedule";

const STATUS_GROUPS: { key: MediaStatus | "all"; label: string }[] = [
  { key: "all", label: "الكل" },
  { key: "watching", label: "أشاهد الآن" },
  { key: "watchlist", label: "قائمة المشاهدة" },
  { key: "completed", label: "مكتمل" },
  { key: "on_hold", label: "متوقف" },
  { key: "dropped", label: "تخليت عنه" },
];

const SORT_OPTIONS = [
  { value: "recent", label: "آخر نشاط" },
  { value: "rating", label: "الأعلى تقييمًا" },
  { value: "added", label: "آخر إضافة" },
  { value: "alpha", label: "أبجديًا" },
  { value: "year", label: "حسب السنة" },
];

// ─────────────────────────────────────────────────────────────
// Main component
// ─────────────────────────────────────────────────────────────

export function LibrarySection({ config }: { config: LibrarySectionConfig }) {
  const { media, updateMediaStatus } = useAppStore();
  const [tab, setTab] = useState<Tab>("library");
  const [statusFilter, setStatusFilter] = useState<MediaStatus | "all">("all");
  const [genreFilter, setGenreFilter] = useState<string>("");
  const [sortBy, setSortBy] = useState<string>("recent");
  const [selectedMedia, setSelectedMedia] = useState<MediaItem | null>(null);

  // All media of this type (from store — reflects updates)
  const typedMedia = useMemo(
    () => media.filter((m) => m.mediaType === config.mediaType),
    [media, config.mediaType]
  );

  // Compute global counters (do NOT depend on current page)
  const counters = useMemo(() => {
    const watching = typedMedia.filter((m) => m.status === "watching").length;
    const watchlist = typedMedia.filter((m) => m.status === "watchlist").length;
    const completed = typedMedia.filter((m) => m.status === "completed").length;
    const onHold = typedMedia.filter((m) => m.status === "on_hold").length;
    const dropped = typedMedia.filter((m) => m.status === "dropped").length;
    const totalEpisodes = typedMedia.reduce((sum, m) => sum + (m.progress || 0), 0);
    return { watching, watchlist, completed, onHold, dropped, total: typedMedia.length, totalEpisodes };
  }, [typedMedia]);

  // Filtered + sorted items
  const filtered = useMemo(() => {
    let items = [...typedMedia];
    if (statusFilter !== "all") {
      items = items.filter((m) => m.status === statusFilter);
    }
    if (genreFilter) {
      items = items.filter((m) => m.genres.includes(genreFilter));
    }
    // Sort
    items.sort((a, b) => {
      switch (sortBy) {
        case "rating":
          return (b.userRating || 0) - (a.userRating || 0);
        case "added":
          return new Date(b.addedAt).getTime() - new Date(a.addedAt).getTime();
        case "alpha":
          return a.title.localeCompare(b.title);
        case "year":
          return new Date(b.releaseDate || "1900").getTime() - new Date(a.releaseDate || "1900").getTime();
        case "recent":
        default:
          return new Date(b.lastWatchedAt || b.addedAt).getTime() - new Date(a.lastWatchedAt || a.addedAt).getTime();
      }
    });
    return items;
  }, [typedMedia, statusFilter, genreFilter, sortBy]);

  // Discover: remove items already in library
  const discoverFiltered = useMemo(() => {
    let items = config.discoverItems.filter(
      (m) => !typedMedia.some((tm) => tm.tmdbId === m.tmdbId)
    );
    if (genreFilter) {
      items = items.filter((m) => m.genres.includes(genreFilter));
    }
    items.sort((a, b) => (b.voteAverage || 0) - (a.voteAverage || 0));
    return items;
  }, [config.discoverItems, typedMedia, genreFilter]);

  const allGenres = useMemo(() => {
    const set = new Set<string>();
    [...typedMedia, ...config.discoverItems].forEach((m) =>
      m.genres.forEach((g) => set.add(g))
    );
    return Array.from(set).sort();
  }, [typedMedia, config.discoverItems]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          {config.arabicTitle}
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          إجمالي {counters.total} عمل • {counters.totalEpisodes} حلقة/watched
        </p>
      </div>

      {/* Global status counters */}
      <div className="grid grid-cols-3 md:grid-cols-6 gap-2">
        <StatusCounter label="أشاهد الآن" count={counters.watching} active={statusFilter === "watching"} onClick={() => { setTab("library"); setStatusFilter("watching"); }} />
        <StatusCounter label="قائمة المشاهدة" count={counters.watchlist} active={statusFilter === "watchlist"} onClick={() => { setTab("library"); setStatusFilter("watchlist"); }} />
        <StatusCounter label="مكتمل" count={counters.completed} active={statusFilter === "completed"} onClick={() => { setTab("library"); setStatusFilter("completed"); }} />
        <StatusCounter label="متوقف" count={counters.onHold} active={statusFilter === "on_hold"} onClick={() => { setTab("library"); setStatusFilter("on_hold"); }} />
        <StatusCounter label="تخليت عنه" count={counters.dropped} active={statusFilter === "dropped"} onClick={() => { setTab("library"); setStatusFilter("dropped"); }} />
        <StatusCounter label="الكل" count={counters.total} active={statusFilter === "all"} onClick={() => { setTab("library"); setStatusFilter("all"); }} />
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-1 border-b border-border overflow-x-auto">
        {[
          { key: "library" as Tab, label: "مكتبتي", icon: LibraryIcon },
          { key: "discover" as Tab, label: "اكتشف", icon: Compass },
          ...(config.hasSchedule
            ? [{ key: "schedule" as Tab, label: config.scheduleLabel, icon: CalendarIcon }]
            : []),
        ].map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={cn(
              "flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors whitespace-nowrap",
              tab === t.key
                ? "border-primary text-primary"
                : "border-transparent text-muted-foreground hover:text-foreground"
            )}
          >
            <t.icon size={15} />
            {t.label}
          </button>
        ))}
      </div>

      {/* Filter bar */}
      <div className="flex items-center gap-2 flex-wrap">
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <ListFilter size={14} />
          فلترة:
        </div>
        {tab !== "schedule" && (
          <>
            <select
              value={genreFilter}
              onChange={(e) => setGenreFilter(e.target.value)}
              className="text-xs bg-card border border-border rounded-md px-2 py-1.5"
            >
              <option value="">كل الأنواع</option>
              {allGenres.map((g) => (
                <option key={g} value={g}>{g}</option>
              ))}
            </select>
            {tab === "library" && (
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value)}
                className="text-xs bg-card border border-border rounded-md px-2 py-1.5"
              >
                {SORT_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>
            )}
            {(genreFilter || (tab === "library" && statusFilter !== "all")) && (
              <button
                onClick={() => { setGenreFilter(""); setStatusFilter("all"); }}
                className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1"
              >
                <X size={12} /> مسح الفلاتر
              </button>
            )}
          </>
        )}
      </div>

      {/* Content per tab */}
      {tab === "library" && (
        <>
          {filtered.length === 0 ? (
            <EmptyState
              title="لا توجد عناصر هنا"
              hint="جرّب تغيير الفلاتر أو أضف أعمالًا من قسم الاكتشاف"
              icon={<LibraryIcon size={48} />}
            />
          ) : (
            <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 gap-3">
              {filtered.map((m) => (
                <MediaCard key={m.id} media={m} onClick={() => setSelectedMedia(m)} />
              ))}
            </div>
          )}
        </>
      )}

      {tab === "discover" && (
        <>
          {discoverFiltered.length === 0 ? (
            <EmptyState
              title="لا توجد أعمال جديدة"
              hint="كل العناصر المتاحة موجودة في مكتبتك بالفعل"
              icon={<Compass size={48} />}
            />
          ) : (
            <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 gap-3">
              {discoverFiltered.map((m) => (
                <DiscoverCard key={m.tmdbId} media={m} onAdd={(status) => {
                  // Add to library by updating an existing mock or pushing new
                  // For demo, we just open the detail modal
                  setSelectedMedia(m);
                }} />
              ))}
            </div>
          )}
        </>
      )}

      {tab === "schedule" && config.upcomingItems && (
        <ScheduleView
          items={config.upcomingItems}
          onSelect={(m) => setSelectedMedia(m)}
        />
      )}

      {/* Media detail drawer */}
      {selectedMedia && (
        <MediaDetailDrawer
          media={selectedMedia}
          onClose={() => setSelectedMedia(null)}
          onStatusChange={(status) => {
            updateMediaStatus(selectedMedia.id, status);
            setSelectedMedia(null);
          }}
        />
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// Discover card with quick add
// ─────────────────────────────────────────────────────────────

function DiscoverCard({ media, onAdd }: { media: MediaItem; onAdd: () => void }) {
  const gradient = pickGradient(media.tmdbId);
  return (
    <div className="card-hover relative w-full overflow-hidden rounded-xl bg-card group">
      <button onClick={onAdd} className="block w-full text-right">
        <div className={cn("relative aspect-[2/3] bg-gradient-to-br", gradient)}>
          <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />
          <div className="absolute bottom-0 left-0 right-0 p-2">
            <h3 className="text-white font-bold text-xs line-clamp-2">{media.title}</h3>
            {media.voteAverage && (
              <span className="text-white/80 text-[10px] flex items-center gap-0.5">
                <Star size={9} /> {media.voteAverage.toFixed(1)}
              </span>
            )}
          </div>
        </div>
      </button>
      <button
        onClick={onAdd}
        className="w-full py-1.5 text-xs font-medium bg-primary/10 text-primary hover:bg-primary/20 transition-colors"
      >
        + أضف للمكتبة
      </button>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// Schedule view (calendar of upcoming episodes or movie releases)
// ─────────────────────────────────────────────────────────────

function ScheduleView({
  items,
  onSelect,
}: {
  items: { date: string; media: MediaItem; season?: number; episode?: number; name?: string }[];
  onSelect: (m: MediaItem) => void;
}) {
  const [filter, setFilter] = useState<"all" | "today" | "week" | "later">("all");

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const weekEnd = new Date(today);
  weekEnd.setDate(weekEnd.getDate() + 7);

  const filtered = items.filter((i) => {
    const d = new Date(i.date);
    if (filter === "today") return d.toDateString() === today.toDateString();
    if (filter === "week") return d <= weekEnd && d >= today;
    if (filter === "later") return d > weekEnd;
    return true;
  });

  // Group by date
  const grouped = new Map<string, typeof items>();
  filtered.forEach((i) => {
    const arr = grouped.get(i.date) || [];
    arr.push(i);
    grouped.set(i.date, arr);
  });

  const sortedDates = Array.from(grouped.keys()).sort();

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 flex-wrap">
        {[
          { key: "all" as const, label: "الكل" },
          { key: "today" as const, label: "اليوم" },
          { key: "week" as const, label: "هذا الأسبوع" },
          { key: "later" as const, label: "لاحقًا" },
        ].map((f) => (
          <button
            key={f.key}
            onClick={() => setFilter(f.key)}
            className={cn(
              "px-3 py-1.5 rounded-full text-xs font-medium",
              filter === f.key ? "bg-primary text-primary-foreground" : "bg-card border border-border"
            )}
          >
            {f.label}
          </button>
        ))}
      </div>

      {sortedDates.length === 0 ? (
        <EmptyState title="لا توجد إصدارات قادمة" icon={<CalendarIcon size={48} />} />
      ) : (
        sortedDates.map((date) => {
          const dayItems = grouped.get(date)!;
          const d = new Date(date);
          const isToday = d.toDateString() === today.toDateString();
          return (
            <div key={date} className="space-y-2">
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-bold">
                  {isToday ? "اليوم" : d.toLocaleDateString("ar-EG", { weekday: "long", day: "numeric", month: "long" })}
                </h3>
                <span className="text-xs text-muted-foreground">({dayItems.length})</span>
              </div>
              <div className="space-y-2">
                {dayItems.map((item, idx) => {
                  const gradient = pickGradient(item.media.tmdbId);
                  return (
                    <button
                      key={idx}
                      onClick={() => onSelect(item.media)}
                      className="card-hover w-full flex items-center gap-3 p-3 rounded-lg bg-card border border-border hover:border-primary/30 text-right"
                    >
                      <div className={cn("w-12 h-16 rounded bg-gradient-to-br shrink-0", gradient)} />
                      <div className="flex-1 min-w-0">
                        <h4 className="text-sm font-medium truncate">{item.media.title}</h4>
                        {item.season && item.episode ? (
                          <p className="text-xs text-muted-foreground mt-0.5">
                            الموسم {item.season} • الحلقة {item.episode}
                            {item.name && ` • ${item.name}`}
                          </p>
                        ) : (
                          <p className="text-xs text-muted-foreground mt-0.5">
                            {item.media.runtime ? `${item.media.runtime} دقيقة` : "إصدار جديد"}
                          </p>
                        )}
                      </div>
                      <ChevronRight size={16} className="text-muted-foreground flip-x" />
                    </button>
                  );
                })}
              </div>
            </div>
          );
        })
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// Media detail drawer (simplified — for demo)
// ─────────────────────────────────────────────────────────────

function MediaDetailDrawer({
  media,
  onClose,
  onStatusChange,
}: {
  media: MediaItem;
  onClose: () => void;
  onStatusChange: (status: MediaStatus) => void;
}) {
  const gradient = pickGradient(media.tmdbId);
  const { updateMediaRating, toggleFavorite } = useAppStore();

  return (
    <div className="fixed inset-0 z-50 flex items-end md:items-center justify-center" onClick={onClose}>
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
      <div
        onClick={(e) => e.stopPropagation()}
        className="relative w-full md:max-w-2xl bg-card rounded-t-2xl md:rounded-2xl max-h-[90vh] overflow-y-auto scroll-thin"
      >
        {/* Hero */}
        <div className={cn("relative aspect-video bg-gradient-to-br", gradient)}>
          <div className="absolute inset-0 hero-fade" />
          <button
            onClick={onClose}
            className="absolute top-3 left-3 bg-black/40 hover:bg-black/60 text-white rounded-full w-8 h-8 flex items-center justify-center"
          >
            <X size={16} />
          </button>
          <div className="absolute bottom-0 left-0 right-0 p-4">
            <h2 className="text-white text-xl font-bold">{media.title}</h2>
            <div className="flex items-center gap-3 mt-1 text-xs text-white/80">
              {media.releaseDate && <span>{new Date(media.releaseDate).getFullYear()}</span>}
              {media.runtime && <span>{media.runtime} دقيقة</span>}
              {media.voteAverage && <span className="flex items-center gap-0.5"><Star size={11} /> {media.voteAverage.toFixed(1)}</span>}
            </div>
          </div>
        </div>

        <div className="p-4 space-y-4">
          {/* Genres */}
          <div className="flex flex-wrap gap-1.5">
            {media.genres.map((g) => (
              <span key={g} className="text-xs px-2 py-0.5 rounded-full bg-accent text-accent-foreground">
                {g}
              </span>
            ))}
          </div>

          {/* Overview */}
          {media.overview && <p className="text-sm text-muted-foreground leading-relaxed">{media.overview}</p>}

          {/* Progress (for TV/Anime) */}
          {media.totalEpisodes && media.totalEpisodes > 1 && (
            <div>
              <div className="flex items-center justify-between text-xs mb-1.5">
                <span className="text-muted-foreground">التقدم</span>
                <span className="font-medium">{media.progress} / {media.totalEpisodes} حلقة</span>
              </div>
              <div className="h-2 rounded-full bg-muted overflow-hidden">
                <div
                  className="h-full bg-primary"
                  style={{ width: `${Math.min(100, (media.progress / media.totalEpisodes) * 100)}%` }}
                />
              </div>
            </div>
          )}

          {/* Status actions */}
          <div>
            <h4 className="text-sm font-medium mb-2">الحالة</h4>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {([
                { key: "watching", label: "أشاهد الآن" },
                { key: "watchlist", label: "قائمة المشاهدة" },
                { key: "completed", label: "مكتمل" },
                { key: "on_hold", label: "متوقف" },
                { key: "dropped", label: "تخليت عنه" },
                { key: "plan_to_watch", label: "أخطط له" },
              ] as const).map((s) => (
                <button
                  key={s.key}
                  onClick={() => onStatusChange(s.key)}
                  className={cn(
                    "px-3 py-2 rounded-md text-xs font-medium border transition-colors",
                    media.status === s.key
                      ? "border-primary bg-primary/10 text-primary"
                      : "border-border hover:bg-accent"
                  )}
                >
                  {s.label}
                </button>
              ))}
            </div>
          </div>

          {/* Rating */}
          {media.status === "completed" && (
            <div>
              <h4 className="text-sm font-medium mb-2">تقييمك</h4>
              <div className="flex items-center gap-2">
                <input
                  type="range"
                  min="0"
                  max="100"
                  value={media.userRating || 0}
                  onChange={(e) => updateMediaRating(media.id, parseInt(e.target.value))}
                  className="flex-1"
                />
                <span className="text-sm font-bold tabular-nums w-12 text-left">
                  {media.userRating || 0}/100
                </span>
              </div>
            </div>
          )}

          {/* Favorite toggle */}
          <button
            onClick={() => toggleFavorite(media.id)}
            className={cn(
              "w-full py-2 rounded-md text-sm font-medium border transition-colors flex items-center justify-center gap-2",
              media.favorite
                ? "border-rose-500 bg-rose-500/10 text-rose-500"
                : "border-border hover:bg-accent"
            )}
          >
            <span>{media.favorite ? "♥" : "♡"}</span>
            {media.favorite ? "في المفضلة" : "أضف للمفضلة"}
          </button>
        </div>
      </div>
    </div>
  );
}
