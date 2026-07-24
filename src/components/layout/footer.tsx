"use client";

import { Clapperboard, Film, Heart, Sparkles } from "lucide-react";
import { useStats } from "@/hooks/use-tmdb";
import { APP_NAME, APP_TAGLINE } from "@/lib/brand";

export function Footer() {
  const stats = useStats();

  return (
    <footer
      className="tvtime-app-footer relative mt-auto overflow-hidden border-t border-border/60 glass"
      aria-label="Application footer"
    >
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -top-12 left-1/4 h-24 w-48 rounded-full bg-primary/10 blur-3xl"
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -top-12 right-1/4 h-24 w-48 rounded-full bg-secondary/45 blur-3xl"
      />

      <div className="relative mx-auto max-w-[1400px] px-4 py-6 sm:px-6">
        <div className="flex flex-col items-center justify-between gap-4 text-sm sm:flex-row">
          <div className="flex items-center gap-2.5">
            <span className="relative" aria-hidden="true">
              <span className="absolute inset-0 rounded-md bg-primary/35 blur-md" />
              <span className="relative flex h-7 w-7 items-center justify-center rounded-md bg-primary">
                <Clapperboard className="h-4 w-4 text-primary-foreground" />
              </span>
            </span>
            <span className="flex items-baseline gap-2">
              <span className="text-gradient text-base font-extrabold">{APP_NAME}</span>
              <span className="hidden text-muted-foreground/40 sm:inline" aria-hidden="true">
                ·
              </span>
              <span className="hidden text-muted-foreground sm:inline">{APP_TAGLINE}</span>
            </span>
          </div>

          {stats.data && (
            <dl
              className="flex items-center gap-4 text-xs"
              aria-label="Viewing summary"
            >
              <div className="flex items-center gap-1.5">
                <Film className="h-3.5 w-3.5 text-primary" aria-hidden="true" />
                <dt className="sr-only">Watched movies</dt>
                <dd className="font-bold text-foreground tabular-nums">
                  {stats.data.counts.watchedMovies}
                </dd>
                <span className="hidden text-muted-foreground sm:inline" aria-hidden="true">
                  movies
                </span>
              </div>
              <div className="flex items-center gap-1.5 border-l border-border/60 pl-4">
                <Sparkles className="h-3.5 w-3.5 text-primary" aria-hidden="true" />
                <dt className="sr-only">Watched episodes</dt>
                <dd className="font-bold text-foreground tabular-nums">
                  {stats.data.counts.watchedEpisodes}
                </dd>
                <span className="hidden text-muted-foreground sm:inline" aria-hidden="true">
                  episodes
                </span>
              </div>
            </dl>
          )}

          <div className="flex items-center gap-3 text-xs text-muted-foreground">
            <span>
              Data by <span className="font-semibold text-foreground">TMDB</span>
            </span>
            <span className="hidden text-muted-foreground/30 sm:inline" aria-hidden="true">
              |
            </span>
            <span className="flex items-center gap-1">
              Built with <Heart className="h-3 w-3 fill-primary text-primary" aria-hidden="true" />
              <span className="sr-only">care</span>
            </span>
          </div>
        </div>
      </div>
    </footer>
  );
}
