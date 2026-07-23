"use client";

import { useId, useRef } from "react";
import { ArrowUpRight, ChevronLeft, ChevronRight } from "lucide-react";

import { MediaCard } from "@/components/media/media-card";
import { Button } from "@/components/ui/button";
import {
  mediaStateKey,
  useMediaStates,
  type MediaBatchState,
} from "@/hooks/use-tmdb";
import type { MediaItem } from "@/lib/tmdb";

interface MediaRowProps {
  title: string;
  items: MediaItem[];
  loading?: boolean;
  icon?: React.ReactNode;
  onSeeAll?: () => void;
  forcedMediaType?: "movie" | "tv";
  libraryStateSource?: { data?: Record<string, MediaBatchState> };
  compactCards?: boolean;
}

export function MediaRow({
  title,
  items,
  loading,
  icon,
  onSeeAll,
  forcedMediaType,
  libraryStateSource,
  compactCards = true,
}: MediaRowProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const headingId = useId();
  const stateRequests = items.map((item) => ({
    tmdbId: Number(item.id),
    mediaType: forcedMediaType || (item.media_type === "tv" ? "tv" : "movie"),
  }));
  const states = useMediaStates(stateRequests, { enabled: !libraryStateSource });
  const stateMap = libraryStateSource ? libraryStateSource.data : states.data;

  const scroll = (direction: "left" | "right") => {
    const scroller = scrollRef.current;
    if (!scroller) return;
    const amount = Math.max(320, scroller.clientWidth * 0.78);
    scroller.scrollBy({
      left: direction === "left" ? -amount : amount,
      behavior: "smooth",
    });
  };

  return (
    <section className="tvtime-media-row" aria-labelledby={headingId}>
      <div className="tvtime-section-heading">
        <div className="flex min-w-0 items-center gap-3">
          {icon && <span className="tvtime-section-heading__icon" aria-hidden="true">{icon}</span>}
          <div className="min-w-0">
            <div className="flex min-w-0 items-baseline gap-2">
              <h2 id={headingId} className="truncate text-lg font-extrabold tracking-tight sm:text-xl">{title}</h2>
              {!loading && <span className="tvtime-section-heading__count tabular-nums">{items.length}</span>}
            </div>
            <p className="tvtime-section-heading__hint">Browse this collection</p>
          </div>
        </div>

        <div className="tvtime-section-heading__actions">
          {onSeeAll && (
            <Button variant="ghost" size="sm" className="tvtime-see-all" onClick={onSeeAll}>
              See all <ArrowUpRight className="h-3.5 w-3.5" />
            </Button>
          )}
          <div className="tvtime-row-controls hidden items-center sm:flex" aria-label={`${title} carousel controls`}>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={() => scroll("left")}
              aria-label={`Scroll ${title} left`}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={() => scroll("right")}
              aria-label={`Scroll ${title} right`}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>

      <div className="tvtime-media-row-viewport">
        <div
          ref={scrollRef}
          className="tvtime-media-row-scroller no-scrollbar flex overflow-x-auto scroll-smooth"
        >
          {loading
            ? Array.from({ length: 8 }).map((_, index) => (
                <div key={index} className="tvtime-media-row-item flex-shrink-0" aria-hidden="true">
                  <div className="aspect-[2/3] rounded-[18px] shimmer" />
                  <div className="mt-3 h-3.5 w-4/5 rounded shimmer" />
                  <div className="mt-2 h-3 w-2/5 rounded shimmer" />
                </div>
              ))
            : items.map((item, index) => (
                <div key={`${item.id}-${item.media_type || ""}`} className="tvtime-media-row-item flex-shrink-0">
                  <MediaCard
                    item={item}
                    index={index}
                    forcedMediaType={forcedMediaType}
                    libraryState={stateMap?.[mediaStateKey(
                      forcedMediaType || (item.media_type === "tv" ? "tv" : "movie"),
                      Number(item.id),
                    )] ?? null}
                    priority={index < 2}
                    compactActions={compactCards}
                  />
                </div>
              ))}
        </div>
      </div>
    </section>
  );
}
