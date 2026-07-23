"use client";

import { Clapperboard, Film, Heart, Sparkles } from "lucide-react";

import { useStats } from "@/hooks/use-tmdb";
import { APP_NAME, APP_TAGLINE } from "@/lib/brand";

export function Footer() {
  const stats = useStats();

  return (
    <footer className="tvtime-app-footer mt-auto" aria-label="Application footer">
      <div className="tvtime-footer-inner mx-auto max-w-[1440px] px-4 py-6 sm:px-6 lg:px-8">
        <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex min-w-0 items-center gap-3">
            <span className="tvtime-footer-mark flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-sm" aria-hidden="true">
              <Clapperboard className="h-4 w-4" />
            </span>
            <span className="min-w-0">
              <span className="block text-sm font-extrabold tracking-tight text-foreground">{APP_NAME}</span>
              <span className="block truncate text-xs text-muted-foreground">{APP_TAGLINE}</span>
            </span>
          </div>

          {stats.data && (
            <dl className="tvtime-footer-stats flex items-center gap-2" aria-label="Viewing summary">
              <div className="tvtime-footer-stat">
                <Film className="h-3.5 w-3.5 text-primary" aria-hidden="true" />
                <dt>Watched movies</dt>
                <dd className="tabular-nums">{stats.data.counts.watchedMovies}</dd>
              </div>
              <div className="tvtime-footer-stat">
                <Sparkles className="h-3.5 w-3.5 text-primary" aria-hidden="true" />
                <dt>Watched episodes</dt>
                <dd className="tabular-nums">{stats.data.counts.watchedEpisodes}</dd>
              </div>
            </dl>
          )}

          <div className="flex items-center justify-between gap-4 text-xs text-muted-foreground sm:justify-end">
            <span>
              Metadata by <span className="font-semibold text-foreground">TMDB</span>
            </span>
            <span className="flex items-center gap-1.5">
              Built with <Heart className="h-3 w-3 fill-primary text-primary" aria-hidden="true" />
              <span className="sr-only">care</span>
            </span>
          </div>
        </div>
      </div>
    </footer>
  );
}
