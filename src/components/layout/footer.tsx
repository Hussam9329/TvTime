"use client";

import { Clapperboard, Film, Heart } from "lucide-react";
import { useStats } from "@/hooks/use-tmdb";
import { APP_TAGLINE } from "@/lib/brand";
import { BrandMark, BrandWordmark } from "@/components/ui/brand-logo";

export function Footer() {
  const stats = useStats();

  return (
    <footer
      className="tvtime-app-footer relative mt-auto overflow-hidden border-t border-border/60 glass"
      aria-label="Application footer"
    >
      <div
        aria-hidden="true"
        className="tvtime-footer-glow pointer-events-none absolute -top-12 left-1/4 h-24 w-48 rounded-full bg-primary/10 blur-3xl"
      />
      <div
        aria-hidden="true"
        className="tvtime-footer-glow pointer-events-none absolute -top-12 right-1/4 h-24 w-48 rounded-full bg-secondary/45 blur-3xl"
      />

      <div className="tvtime-footer-inner relative mx-auto px-4 py-6 sm:px-6">
        <div className="tvtime-footer-row flex flex-col items-center justify-between gap-4 text-sm sm:flex-row sm:flex-wrap lg:flex-nowrap">
          <div className="tvtime-footer-brand flex min-w-0 items-center gap-2.5">
            <BrandMark className="tvtime-footer-mark h-8 w-8 rounded-lg sm:h-8 sm:w-8" />
            <span className="flex min-w-0 items-baseline gap-2">
              <BrandWordmark className="text-base" />
              <span className="hidden text-muted-foreground/40 lg:inline" aria-hidden="true">
                ·
              </span>
              <span className="hidden text-muted-foreground lg:inline">{APP_TAGLINE}</span>
            </span>
          </div>

          {stats.data && (
            <dl
              className="tvtime-footer-stats flex items-center text-xs"
              aria-label="Viewing summary"
            >
              <div className="tvtime-footer-stat">
                <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-fuchsia-500/10 text-fuchsia-400" aria-hidden="true">
                  <Film className="h-3.5 w-3.5" />
                </span>
                <dt className="sr-only">Watched movies</dt>
                <dd className="tabular-nums">
                  {stats.data.counts.watchedMovies}
                </dd>
                <span className="text-muted-foreground" aria-hidden="true">
                  movies
                </span>
              </div>
              <div className="tvtime-footer-stat">
                <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-cyan-500/10 text-cyan-400" aria-hidden="true">
                  <Clapperboard className="h-3.5 w-3.5" />
                </span>
                <dt className="sr-only">Watched episodes</dt>
                <dd className="tabular-nums">
                  {stats.data.counts.watchedEpisodes}
                </dd>
                <span className="text-muted-foreground" aria-hidden="true">
                  episodes
                </span>
              </div>
            </dl>
          )}

          <div className="tvtime-footer-attribution flex items-center gap-3 text-xs text-muted-foreground">
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
