"use client";

import { useRef } from "react";
import { MEDIA_CARD_ROW_WIDTH_CLASS, MediaCard, MediaCardSkeleton } from "./media-card";
import type { MediaItem } from "@/lib/tmdb";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { mediaStateKey, useMediaStates, type MediaBatchState } from "@/hooks/use-tmdb";

interface MediaRowProps {
  title: string;
  items: MediaItem[];
  loading?: boolean;
  icon?: React.ReactNode;
  onSeeAll?: () => void;
  forcedMediaType?: "movie" | "tv";
  libraryStateSource?: { data?: Record<string, MediaBatchState> };
  compactCards?: boolean;
  hideHeading?: boolean;
}

export function MediaRow({ title, items, loading, icon, onSeeAll, forcedMediaType, libraryStateSource, compactCards = true, hideHeading = false }: MediaRowProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const isArabic = /[\u0600-\u06FF]/.test(title);
  const stateRequests = items.map((item) => ({
    tmdbId: Number(item.id),
    mediaType: forcedMediaType || (item.media_type === "tv" ? "tv" : "movie"),
  }));
  const states = useMediaStates(stateRequests, { enabled: !libraryStateSource });
  const stateMap = libraryStateSource ? libraryStateSource.data : states.data;
  const libraryStateReady = libraryStateSource
    ? libraryStateSource.data !== undefined
    : states.isSuccess;

  const scroll = (dir: "left" | "right") => {
    if (!scrollRef.current) return;
    const amount = scrollRef.current.clientWidth * 0.8;
    scrollRef.current.scrollBy({ left: dir === "left" ? -amount : amount, behavior: "smooth" });
  };

  return (
    <section className="tvtime-media-row">
      {!hideHeading && <div className="tvtime-section-heading">
        <div className="flex min-w-0 items-center gap-2.5">
          {icon && <span className="tvtime-section-heading__icon" aria-hidden="true">{icon}</span>}
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h2 className="truncate text-lg font-extrabold tracking-tight sm:text-xl">{title}</h2>
              {!loading && (
                <span className="tvtime-section-heading__count tabular-nums">{items.length}</span>
              )}
            </div>
            <p className="tvtime-section-heading__hint">{isArabic ? "مختارة لك" : "Curated for you"}</p>
          </div>
        </div>
        <div className="tvtime-section-heading__actions">
          {onSeeAll && (
            <Button variant="ghost" size="sm" className="tvtime-see-all" onClick={onSeeAll}>
              {isArabic ? "عرض الكل" : "See all"}
            </Button>
          )}
          <div className="tvtime-row-controls hidden items-center sm:flex">
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={() => scroll("left")}
              aria-label={isArabic ? `مرّر ${title} إلى اليمين` : `Scroll ${title} left`}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={() => scroll("right")}
              aria-label={isArabic ? `مرّر ${title} إلى اليسار` : `Scroll ${title} right`}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>}
      <div className="tvtime-media-row-viewport">
        <div
          ref={scrollRef}
          className="tvtime-media-row-scroller no-scrollbar flex overflow-x-auto scroll-smooth"
        >
          {loading
            ? Array.from({ length: 8 }).map((_, i) => (
                <div key={i} className={`tvtime-media-row-item flex-shrink-0 ${MEDIA_CARD_ROW_WIDTH_CLASS}`}>
                  <MediaCardSkeleton />
                </div>
              ))
            : items.map((item, i) => (
                <div key={`${item.id}-${item.media_type || ""}`} className={`tvtime-media-row-item flex-shrink-0 ${MEDIA_CARD_ROW_WIDTH_CLASS}`}>
                  <MediaCard
                    item={item}
                    index={i}
                    forcedMediaType={forcedMediaType}
                    libraryState={stateMap?.[mediaStateKey(
                      forcedMediaType || (item.media_type === "tv" ? "tv" : "movie"),
                      Number(item.id),
                    )] ?? null}
                    libraryStateReady={libraryStateReady}
                    priority={i < 2}
                    compactActions={compactCards}
                  />
                </div>
              ))}
        </div>
      </div>
    </section>
  );
}
