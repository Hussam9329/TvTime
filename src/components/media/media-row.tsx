"use client";

import { useRef } from "react";
import { MediaCard } from "./media-card";
import type { MediaItem } from "@/lib/tmdb";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { mediaStateKey, useMediaStates } from "@/hooks/use-tmdb";

interface MediaRowProps {
  title: string;
  items: MediaItem[];
  loading?: boolean;
  icon?: React.ReactNode;
  onSeeAll?: () => void;
  forcedMediaType?: "movie" | "tv";
}

export function MediaRow({ title, items, loading, icon, onSeeAll, forcedMediaType }: MediaRowProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const stateRequests = items.map((item) => ({
    tmdbId: Number(item.id),
    mediaType: forcedMediaType || (item.media_type === "tv" ? "tv" : "movie"),
  }));
  const states = useMediaStates(stateRequests);

  const scroll = (dir: "left" | "right") => {
    if (!scrollRef.current) return;
    const amount = scrollRef.current.clientWidth * 0.8;
    scrollRef.current.scrollBy({ left: dir === "left" ? -amount : amount, behavior: "smooth" });
  };

  return (
    <section className="mb-8">
      <div className="flex items-center justify-between mb-3 px-1">
        <div className="flex items-center gap-2">
          {icon && <span className="text-primary">{icon}</span>}
          <h2 className="text-lg sm:text-xl font-bold tracking-tight">{title}</h2>
          {!loading && (
            <span className="text-xs text-muted-foreground ml-1">({items.length})</span>
          )}
        </div>
        <div className="flex items-center gap-1">
          {onSeeAll && (
            <Button variant="ghost" size="sm" className="text-xs" onClick={onSeeAll}>
              See all
            </Button>
          )}
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 flex"
            onClick={() => scroll("left")}
            aria-label="Scroll left"
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 flex"
            onClick={() => scroll("right")}
            aria-label="Scroll right"
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>
      <div
        ref={scrollRef}
        className="flex gap-3 sm:gap-4 overflow-x-auto no-scrollbar pb-2 -mx-1 px-1 scroll-smooth"
      >
        {loading
          ? Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="flex-shrink-0 w-[130px] sm:w-[160px]">
                <div className="aspect-[2/3] shimmer rounded-lg" />
              </div>
            ))
          : items.map((item, i) => (
              <div key={`${item.id}-${item.media_type || ""}`} className={cn("flex-shrink-0 w-[130px] sm:w-[160px]")}>
                <MediaCard
                  item={item}
                  index={i}
                  forcedMediaType={forcedMediaType}
                  libraryState={states.data?.[mediaStateKey(
                    forcedMediaType || (item.media_type === "tv" ? "tv" : "movie"),
                    Number(item.id),
                  )] ?? null}
                />
              </div>
            ))}
      </div>
    </section>
  );
}
