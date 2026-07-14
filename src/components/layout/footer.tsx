"use client";

import { Film, Heart, Clapperboard, Sparkles } from "lucide-react";
import { useStats } from "@/hooks/use-tmdb";

export function Footer() {
  const stats = useStats();

  return (
    <footer className="mt-auto border-t border-border/60 glass relative overflow-hidden">
      {/* Decorative gradient glow */}
      <div className="absolute -top-12 left-1/4 w-48 h-24 rounded-full bg-primary/10 blur-3xl pointer-events-none" />
      <div className="absolute -top-12 right-1/4 w-48 h-24 rounded-full bg-purple-500/5 blur-3xl pointer-events-none" />

      <div className="max-w-[1400px] mx-auto px-4 sm:px-6 py-6 relative">
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 text-sm">
          <div className="flex items-center gap-2.5">
            <div className="relative">
              <div className="absolute inset-0 bg-primary/40 blur-md rounded-md" />
              <div className="relative w-7 h-7 rounded-md bg-primary flex items-center justify-center">
                <Clapperboard className="w-4 h-4 text-primary-foreground" />
              </div>
            </div>
            <div className="flex items-baseline gap-2">
              <span className="font-extrabold text-gradient text-base">TvTime</span>
              <span className="text-muted-foreground/40 hidden sm:inline">·</span>
              <span className="text-muted-foreground hidden sm:inline">Your personal cinema companion</span>
            </div>
          </div>

          {/* Live mini stats */}
          {stats.data && (
            <div className="flex items-center gap-4 text-xs">
              <span className="flex items-center gap-1.5">
                <Film className="w-3.5 h-3.5 text-primary" />
                <span className="font-bold text-foreground">{stats.data.counts.watchedMovies}</span>
                <span className="text-muted-foreground hidden sm:inline">movies</span>
              </span>
              <span className="text-muted-foreground/30">|</span>
              <span className="flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-primary" />
                <span className="font-bold text-foreground">{stats.data.counts.watchedEpisodes}</span>
                <span className="text-muted-foreground hidden sm:inline">episodes</span>
              </span>
            </div>
          )}

          <div className="flex items-center gap-3 text-xs">
            <span className="text-muted-foreground">
              © {new Date().getFullYear()} TvTime
            </span>
            <span className="text-muted-foreground/30 hidden sm:inline">|</span>
            <span className="text-muted-foreground">
              Powered by <span className="font-semibold text-foreground">TMDB</span>
            </span>
            <span className="text-muted-foreground/30 hidden sm:inline">|</span>
            <span className="flex items-center gap-1 text-muted-foreground">
              Built with <Heart className="w-3 h-3 fill-primary text-primary" />
            </span>
          </div>
        </div>
      </div>
    </footer>
  );
}
