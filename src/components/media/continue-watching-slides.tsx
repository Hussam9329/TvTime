"use client";

import { useRecentlyWatched } from "@/hooks/use-tmdb";
import { useNav } from "@/lib/store";
import { imgOrPlaceholder } from "@/lib/tmdb";
import { SafeImage } from "@/components/media/safe-image";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Film, Clapperboard, Sparkles, Languages, Play, Clock } from "lucide-react";
import { motion } from "framer-motion";
import type { RecentlyWatchedItem } from "@/hooks/use-tmdb";

/**
 * ContinueWatchingSlides — shows ONE recently-watched item per category
 * as a horizontal slide carousel. Categories:
 *   - Movie (latest watched non-Arabic, non-Anime movie)
 *   - TV (latest watched episode of a non-Arabic, non-Anime show)
 *   - Anime (latest watched anime movie or episode)
 *   - Arabic Movie (latest watched Arabic movie)
 *   - Arabic TV (latest watched Arabic TV episode)
 *
 * Only items with watched=true (movies) or watched-episode records (TV)
 * appear. The section is hidden entirely if no items are watched.
 */
const CATEGORY_META: Record<string, { label: string; icon: React.ElementType; color: string; view: string }> = {
  movie: { label: "Last Movie", icon: Film, color: "from-blue-500/20 to-blue-500/5", view: "movies" },
  tv: { label: "Last TV Episode", icon: Clapperboard, color: "from-purple-500/20 to-purple-500/5", view: "tv-shows" },
  anime: { label: "Last Anime", icon: Sparkles, color: "from-fuchsia-500/20 to-fuchsia-500/5", view: "anime" },
  "arabic-movie": { label: "آخر فيلم عربي", icon: Film, color: "from-emerald-500/20 to-emerald-500/5", view: "arabic-movies" },
  "arabic-tv": { label: "آخر مسلسل عربي", icon: Clapperboard, color: "from-amber-500/20 to-amber-500/5", view: "arabic-tv" },
};

const CATEGORY_ORDER = ["movie", "tv", "anime", "arabic-movie", "arabic-tv"];

export function ContinueWatchingSlides() {
  const recently = useRecentlyWatched(50);
  const goMovie = useNav((s) => s.goMovie);
  const goTv = useNav((s) => s.goTv);
  const setView = useNav((s) => s.setView);

  // Pick the LATEST item per category
  const slides: RecentlyWatchedItem[] = [];
  const seenCategories = new Set<string>();

  for (const item of (recently.data?.items ?? [])) {
    const cat = item.category;
    if (!cat || seenCategories.has(cat)) continue;
    seenCategories.add(cat);
    slides.push(item);
  }

  // Sort slides by CATEGORY_ORDER
  slides.sort((a, b) => {
    const ai = CATEGORY_ORDER.indexOf(a.category ?? "");
    const bi = CATEGORY_ORDER.indexOf(b.category ?? "");
    return ai - bi;
  });

  if (slides.length === 0) return null;

  const handleGo = (item: RecentlyWatchedItem) => {
    if (!item.tmdbId) {
      const meta = CATEGORY_META[item.category ?? "movie"];
      if (meta) setView(meta.view as any);
      return;
    }
    if (item.kind === "movie") goMovie(item.tmdbId);
    else goTv(item.tmdbId);
  };

  return (
    <section className="space-y-3">
      <div className="flex items-center gap-2 px-1">
        <Play className="w-5 h-5 text-primary" />
        <h2 className="text-lg sm:text-xl font-bold tracking-tight">Continue Watching</h2>
      </div>

      <div className="flex gap-4 overflow-x-auto no-scrollbar pb-2 -mx-3 px-3 sm:mx-0 sm:px-0">
        {slides.map((item, index) => {
          const meta = CATEGORY_META[item.category ?? "movie"];
          const Icon = meta.icon;
          const isArabic = item.category?.startsWith("arabic");

          return (
            <motion.div
              key={`${item.category}-${item.id}`}
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: index * 0.1, duration: 0.4 }}
              className="flex-shrink-0 w-[280px] sm:w-[340px]"
            >
              <Card
                className={`overflow-hidden p-0 border-border/50 hover:border-primary/40 transition-all cursor-pointer active:scale-[0.98] bg-gradient-to-br ${meta.color}`}
                onClick={() => handleGo(item)}
              >
                {/* Poster + overlay */}
                <div className="relative aspect-video overflow-hidden">
                  <SafeImage
                    src={item.posterPath ? imgOrPlaceholder(item.posterPath, "w500") : null}
                    alt={item.title}
                    fill
                    variant="backdrop"
                    className="object-cover"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent" />

                  {/* Category badge */}
                  <div className="absolute top-2 left-2">
                    <Badge className={`backdrop-blur border-0 text-[10px] h-6 px-2 ${isArabic ? "bg-emerald-500/20 text-emerald-300" : "bg-black/60 text-white"}`}>
                      <Icon className="w-3 h-3 mr-1" />
                      {meta.label}
                    </Badge>
                  </div>

                  {/* Episode subtitle for TV */}
                  {item.subtitle && (
                    <div className="absolute top-2 right-2">
                      <Badge className="bg-black/60 backdrop-blur text-white border-0 text-[10px] h-6 px-2">
                        {item.subtitle}
                      </Badge>
                    </div>
                  )}

                  {/* Title at bottom */}
                  <div className="absolute bottom-0 left-0 right-0 p-3">
                    <p className="text-sm font-bold text-white line-clamp-1">{item.title}</p>
                    <p className="text-[10px] text-white/70 flex items-center gap-1 mt-0.5">
                      <Clock className="w-3 h-3" />
                      {new Date(item.watchedAt).toLocaleDateString()}
                    </p>
                  </div>
                </div>
              </Card>
            </motion.div>
          );
        })}
      </div>
    </section>
  );
}
