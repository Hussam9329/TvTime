"use client";

import { useMemo } from "react";
import { useAppStore } from "@/lib/store";
import { cn } from "@/lib/utils";
import { pickGradient } from "@/lib/mock-data";
import { MediaCard, SectionHeader, PosterRail, BackdropRail } from "./shared";
import {
  PlayCircle,
  CheckCircle2,
  Clock,
  Sparkles,
  TrendingUp,
  CalendarClock,
  ChevronRight,
  Bell,
  AlertTriangle,
  Flame,
  Star,
  Heart,
} from "lucide-react";
import type { MediaItem, MediaType } from "@/lib/types";

// ─────────────────────────────────────────────────────────────
// Watch Next — smart algorithm
// Priority: 1) Aired today 2) Currently watching 3) Backlog (oldest unwatched)
// ─────────────────────────────────────────────────────────────

function useWatchNext(): MediaItem | null {
  const { media } = useAppStore();
  return useMemo(() => {
    const watching = media.filter((m) => m.status === "watching" && m.nextEpisode);
    if (watching.length === 0) return null;

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // 1. Episode airing today
    const todayEpisode = watching.find((m) => {
      const d = new Date(m.nextEpisode!.airDate);
      return d.toDateString() === today.toDateString();
    });
    if (todayEpisode) return todayEpisode;

    // 2. Episode aired but not yet watched (most recent aired)
    const airedNotWatched = watching
      .filter((m) => new Date(m.nextEpisode!.airDate) <= today)
      .sort((a, b) => new Date(b.nextEpisode!.airDate).getTime() - new Date(a.nextEpisode!.airDate).getTime());
    if (airedNotWatched.length > 0) return airedNotWatched[0];

    // 3. Oldest backlog
    const backlog = watching
      .filter((m) => new Date(m.nextEpisode!.airDate) > today)
      .sort((a, b) => new Date(a.nextEpisode!.airDate).getTime() - new Date(b.nextEpisode!.airDate).getTime());
    if (backlog.length > 0) return backlog[0];

    return watching[0];
  }, [media]);
}

// ─────────────────────────────────────────────────────────────
// Continue Watching — REAL: shows items that have a next episode to watch
// ─────────────────────────────────────────────────────────────

function useContinueWatching(limit = 10): MediaItem[] {
  const { media } = useAppStore();
  return useMemo(() => {
    return media
      .filter((m) => m.status === "watching" && m.lastWatchedAt)
      .sort((a, b) => new Date(b.lastWatchedAt!).getTime() - new Date(a.lastWatchedAt!).getTime())
      .slice(0, limit);
  }, [media, limit]);
}

// ─────────────────────────────────────────────────────────────
// Today & This Week — upcoming episodes/releases
// ─────────────────────────────────────────────────────────────

function useUpcoming() {
  const { media } = useAppStore();
  return useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    const weekEnd = new Date(today);
    weekEnd.setDate(weekEnd.getDate() + 7);

    const upcoming = media
      .filter((m) => m.nextEpisode && m.status === "watching")
      .map((m) => ({
        media: m,
        nextEpisode: m.nextEpisode!,
        date: new Date(m.nextEpisode!.airDate),
      }));

    return {
      today: upcoming.filter((u) => u.date.toDateString() === today.toDateString()),
      tomorrow: upcoming.filter((u) => u.date.toDateString() === tomorrow.toDateString()),
      thisWeek: upcoming.filter((u) => u.date > tomorrow && u.date <= weekEnd),
      later: upcoming.filter((u) => u.date > weekEnd).slice(0, 5),
    };
  }, [media]);
}

// ─────────────────────────────────────────────────────────────
// For You — based on user's high-rated genres
// ─────────────────────────────────────────────────────────────

function useForYou() {
  const { media } = useAppStore();
  return useMemo(() => {
    // Find genres the user rated >= 80
    const likedGenres = new Map<string, number>();
    media
      .filter((m) => m.userRating && m.userRating >= 80)
      .forEach((m) => m.genres.forEach((g) => likedGenres.set(g, (likedGenres.get(g) || 0) + 1)));

    const topGenres = Array.from(likedGenres.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([g]) => g);

    // Find items matching top genres that user hasn't completed
    const suggestions = media
      .filter(
        (m) =>
          m.status !== "completed" &&
          m.genres.some((g) => topGenres.includes(g))
      )
      .sort((a, b) => (b.voteAverage || 0) - (a.voteAverage || 0))
      .slice(0, 12);

    return { suggestions, topGenres };
  }, [media]);
}

// ─────────────────────────────────────────────────────────────
// Main Home View
// ─────────────────────────────────────────────────────────────

export function HomeView() {
  const { media, setView } = useAppStore();
  const watchNext = useWatchNext();
  const continueWatching = useContinueWatching();
  const upcoming = useUpcoming();
  const forYou = useForYou();

  // Library indicators (4 only)
  const indicators = useMemo(() => {
    const inProgress = media.filter((m) => m.status === "watching").length;
    const unwatchedEpisodes = media
      .filter((m) => m.status === "watching")
      .reduce((sum, m) => {
        if (!m.nextEpisode) return sum;
        const aired = new Date(m.nextEpisode.airDate) <= new Date();
        return aired ? sum + 1 : sum;
      }, 0);
    const upcomingThisWeek = upcoming.today.length + upcoming.tomorrow.length + upcoming.thisWeek.length;
    const watchlist = media.filter((m) => m.status === "watchlist" || m.status === "plan_to_watch").length;
    return { inProgress, unwatchedEpisodes, upcomingThisWeek, watchlist };
  }, [media, upcoming]);

  // Trending and popular sections
  const trending = useMemo(
    () => [...media].sort((a, b) => (b.voteAverage || 0) - (a.voteAverage || 0)).slice(0, 12),
    [media]
  );

  const recentlyWatched = useMemo(
    () =>
      media
        .filter((m) => m.lastWatchedAt)
        .sort((a, b) => new Date(b.lastWatchedAt!).getTime() - new Date(a.lastWatchedAt!).getTime())
        .slice(0, 12),
    [media]
  );

  return (
    <div className="space-y-8 pb-4">
      {/* Greeting */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">أهلًا محمد 👋</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            {new Date().toLocaleDateString("ar-EG", { weekday: "long", day: "numeric", month: "long" })}
          </p>
        </div>
        <button className="relative w-10 h-10 rounded-full bg-card border border-border flex items-center justify-center hover:bg-accent">
          <Bell size={18} />
          <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-rose-500 rounded-full" />
        </button>
      </div>

      {/* 1. Watch Next — top priority */}
      {watchNext && <WatchNextCard media={watchNext} />}

      {/* 2. Today & This Week strip */}
      <section>
        <SectionHeader title="اليوم وهذا الأسبوع" subtitle="حلقات قادمة من المسلسلات التي تتابعها" />
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
          <UpcomingTile label="اليوم" count={upcoming.today.length} items={upcoming.today} color="bg-rose-500" />
          <UpcomingTile label="غدًا" count={upcoming.tomorrow.length} items={upcoming.tomorrow} color="bg-amber-500" />
          <UpcomingTile label="هذا الأسبوع" count={upcoming.thisWeek.length} items={upcoming.thisWeek} color="bg-emerald-500" />
          <UpcomingTile label="حلقات متراكمة" count={indicators.unwatchedEpisodes} items={[]} color="bg-orange-500" />
        </div>
      </section>

      {/* 3. Continue Watching — REAL */}
      {continueWatching.length > 0 && (
        <section>
          <SectionHeader
            title="أكمل المشاهدة"
            subtitle="الحلقات التالية بانتظارك"
            action={
              <button
                onClick={() => setView("tvshows")}
                className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1"
              >
                عرض الكل <ChevronRight size={12} className="flip-x" />
              </button>
            }
          />
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
            {continueWatching.slice(0, 4).map((m) => (
              <ContinueWatchingCard key={m.id} media={m} />
            ))}
          </div>
        </section>
      )}

      {/* 4. My Library Now — 4 indicators only */}
      <section>
        <SectionHeader title="مكتبتي الآن" subtitle="نظرة سريعة على وضعك الحالي" />
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <button
            onClick={() => setView("tvshows")}
            className="card-hover p-4 rounded-xl bg-card border border-border hover:border-primary/30 text-right"
          >
            <PlayCircle className="text-primary mb-2" size={24} />
            <div className="text-2xl font-bold tabular-nums">{indicators.inProgress}</div>
            <div className="text-xs text-muted-foreground">قيد المشاهدة</div>
          </button>
          <button
            onClick={() => setView("tvshows")}
            className="card-hover p-4 rounded-xl bg-card border border-border hover:border-primary/30 text-right"
          >
            <AlertTriangle className="text-amber-500 mb-2" size={24} />
            <div className="text-2xl font-bold tabular-nums">{indicators.unwatchedEpisodes}</div>
            <div className="text-xs text-muted-foreground">حلقات متراكمة</div>
          </button>
          <button
            onClick={() => setView("tvshows")}
            className="card-hover p-4 rounded-xl bg-card border border-border hover:border-primary/30 text-right"
          >
            <CalendarClock className="text-emerald-500 mb-2" size={24} />
            <div className="text-2xl font-bold tabular-nums">{indicators.upcomingThisWeek}</div>
            <div className="text-xs text-muted-foreground">هذا الأسبوع</div>
          </button>
          <button
            onClick={() => setView("movies")}
            className="card-hover p-4 rounded-xl bg-card border border-border hover:border-primary/30 text-right"
          >
            <Heart className="text-rose-500 mb-2" size={24} />
            <div className="text-2xl font-bold tabular-nums">{indicators.watchlist}</div>
            <div className="text-xs text-muted-foreground">قائمة المشاهدة</div>
          </button>
        </div>
      </section>

      {/* 5. For You — with reasons */}
      {forYou.suggestions.length > 0 && (
        <section>
          <SectionHeader
            title="مقترحات لك"
            subtitle={forYou.topGenres.length > 0 ? "لأنك أحببت: " + forYou.topGenres.join("، ") : "مختارة لك"}
          />
          <PosterRail items={forYou.suggestions} />
        </section>
      )}

      {/* 6. Recently watched */}
      {recentlyWatched.length > 0 && (
        <section>
          <SectionHeader title="شاهدتها مؤخرًا" subtitle="آخر أعمالك" />
          <PosterRail items={recentlyWatched} />
        </section>
      )}

      {/* 7. Discovery (after personal content) */}
      <section>
        <SectionHeader
          title="الرائج الآن"
          subtitle="الأعلى تقييمًا"
          action={
            <button
              onClick={() => setView("movies")}
              className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1"
            >
              المزيد <ChevronRight size={12} className="flip-x" />
            </button>
          }
        />
        <BackdropRail items={trending} />
      </section>

      {/* 8. Quick access to library sections */}
      <section>
        <SectionHeader title="استكشف مكتباتك" />
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          {[
            { key: "movies" as const, mediaType: "movie" as const, label: "أفلام", icon: PlayCircle, color: "from-red-500 to-orange-500" },
            { key: "tvshows" as const, mediaType: "tv" as const, label: "مسلسلات", icon: PlayCircle, color: "from-purple-600 to-indigo-600" },
            { key: "anime" as const, mediaType: "anime" as const, label: "أنمي", icon: Sparkles, color: "from-pink-500 to-rose-600" },
            { key: "arabic_tv" as const, mediaType: "arabic_tv" as const, label: "مسلسلات عربية", icon: PlayCircle, color: "from-emerald-500 to-teal-600" },
            { key: "arabic_movies" as const, mediaType: "arabic_movie" as const, label: "أفلام عربية", icon: PlayCircle, color: "from-amber-500 to-red-600" },
            { key: "stats" as const, mediaType: null as null, label: "إحصائياتي", icon: TrendingUp, color: "from-cyan-500 to-blue-600" },
          ].map((s) => {
            const count = s.mediaType ? media.filter((m) => m.mediaType === s.mediaType).length : 0;
            const subLabel = s.key === "stats" ? "تحليل شخصي" : count + " عمل";
            return (
              <button
                key={s.key}
                onClick={() => setView(s.key)}
                className={cn(
                  "card-hover relative h-20 rounded-xl overflow-hidden bg-gradient-to-br p-4 text-right",
                  s.color
                )}
              >
                <div className="absolute inset-0 bg-black/20" />
                <div className="relative flex items-center justify-between h-full">
                  <div>
                    <div className="text-white font-bold">{s.label}</div>
                    <div className="text-white/80 text-xs mt-0.5">{subLabel}</div>
                  </div>
                  <s.icon size={28} className="text-white/80" />
                </div>
              </button>
            );
          })}
        </div>
      </section>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// Watch Next card — single clear decision
// ─────────────────────────────────────────────────────────────

function WatchNextCard({ media }: { media: MediaItem }) {
  const { setView } = useAppStore();
  const gradient = pickGradient(media.tmdbId);
  const next = media.nextEpisode;
  if (!next) return null;

  const airDate = new Date(next.airDate);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const isToday = airDate.toDateString() === today.toDateString();
  const isAired = airDate <= today;
  const daysAired = Math.floor((today.getTime() - airDate.getTime()) / (1000 * 60 * 60 * 24));

  return (
    <section className={cn("relative rounded-2xl overflow-hidden bg-gradient-to-br", gradient)}>
      <div className="absolute inset-0 bg-black/30" />
      <div className="absolute inset-0 hero-fade" />
      <div className="relative p-5 md:p-6">
        <div className="flex items-center gap-2 mb-3">
          <span className="text-xs font-bold uppercase tracking-wider text-white/90 flex items-center gap-1.5">
            <Flame size={12} /> شاهد الآن
          </span>
        </div>
        <h2 className="text-white text-2xl md:text-3xl font-bold mb-1">{media.title}</h2>
        <div className="flex items-center gap-3 text-white/90 text-sm mb-4">
          <span className="font-medium">الموسم {next.season} • الحلقة {next.episode}</span>
          {next.name && <span className="text-white/70">— {next.name}</span>}
        </div>
        <div className="flex items-center gap-2 text-xs text-white/80 mb-4">
          {isToday && <span className="px-2 py-0.5 rounded-full bg-rose-500 text-white font-medium">صدرت اليوم</span>}
          {!isToday && isAired && (
            <span className="px-2 py-0.5 rounded-full bg-emerald-600 text-white font-medium">
              صدرت {daysAired} يومًا
            </span>
          )}
          {!isAired && (
            <span className="px-2 py-0.5 rounded-full bg-amber-500 text-white font-medium">
              تصدر في {airDate.toLocaleDateString("ar-EG", { day: "numeric", month: "short" })}
            </span>
          )}
          {next.runtime && <span className="flex items-center gap-1"><Clock size={11} /> {next.runtime} دقيقة</span>}
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <button className="bg-white text-black px-4 py-2 rounded-md text-sm font-bold flex items-center gap-2 hover:bg-white/90">
            <PlayCircle size={16} /> شاهد
          </button>
          <button className="bg-white/20 text-white px-4 py-2 rounded-md text-sm font-medium flex items-center gap-2 hover:bg-white/30">
            <CheckCircle2 size={16} /> تمت المشاهدة
          </button>
          <button
            onClick={() => setView("tvshows")}
            className="bg-transparent text-white/90 px-3 py-2 rounded-md text-sm font-medium hover:bg-white/10"
          >
            لاحقًا
          </button>
        </div>
      </div>
    </section>
  );
}

// ─────────────────────────────────────────────────────────────
// Upcoming tile
// ─────────────────────────────────────────────────────────────

function UpcomingTile({
  label,
  count,
  items,
  color,
}: {
  label: string;
  count: number;
  items: { media: MediaItem; nextEpisode: { season: number; episode: number; name?: string }; date: Date }[];
  color: string;
}) {
  return (
    <button className={cn("relative p-3 rounded-xl text-right overflow-hidden", color)}>
      <div className="text-white">
        <div className="text-xs font-medium opacity-90">{label}</div>
        <div className="text-2xl font-bold mt-1 tabular-nums">{count}</div>
        {items.length > 0 && (
          <div className="text-[10px] opacity-80 mt-0.5 line-clamp-1">
            {items[0].media.title}
          </div>
        )}
      </div>
    </button>
  );
}

// ─────────────────────────────────────────────────────────────
// Continue Watching card — shows next episode + progress
// ─────────────────────────────────────────────────────────────

function ContinueWatchingCard({ media }: { media: MediaItem }) {
  const { markEpisodeWatched } = useAppStore();
  const gradient = pickGradient(media.tmdbId);
  const next = media.nextEpisode;
  const total = media.totalEpisodes || 1;
  const progress = media.progress || 0;
  const percent = Math.min(100, (progress / total) * 100);

  return (
    <div className="card-hover rounded-xl overflow-hidden bg-card border border-border">
      <div className={cn("relative aspect-video bg-gradient-to-br", gradient)}>
        <div className="absolute inset-0 hero-fade" />
        <div className="absolute bottom-0 left-0 right-0 p-3">
          <h3 className="text-white font-bold text-sm line-clamp-1">{media.title}</h3>
          {next && (
            <p className="text-white/80 text-xs mt-0.5">
              التالية: الموسم {next.season} • الحلقة {next.episode}
            </p>
          )}
        </div>
      </div>
      <div className="p-3 space-y-2">
        <div className="flex items-center justify-between text-xs">
          <span className="text-muted-foreground">{progress} / {total}</span>
          <span className="text-muted-foreground">{Math.round(percent)}%</span>
        </div>
        <div className="h-1.5 rounded-full bg-muted overflow-hidden">
          <div className="h-full bg-primary" style={{ width: percent + "%" }} />
        </div>
        <div className="flex items-center gap-1.5">
          <button
            onClick={() => next && markEpisodeWatched(media.id, next.season, next.episode, true)}
            className="flex-1 py-1.5 text-xs font-medium bg-primary/10 text-primary rounded-md hover:bg-primary/20 flex items-center justify-center gap-1"
          >
            <CheckCircle2 size={13} /> شاهدت
          </button>
          <button className="px-3 py-1.5 text-xs font-medium border border-border rounded-md hover:bg-accent flex items-center gap-1">
            <PlayCircle size={13} /> شاهد
          </button>
        </div>
      </div>
    </div>
  );
}
