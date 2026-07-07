"use client";

import { Film, Github, Heart, TMDB } from "lucide-react";

export function Footer() {
  return (
    <footer className="mt-auto border-t border-border/60 glass">
      <div className="max-w-[1400px] mx-auto px-4 sm:px-6 py-6">
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 text-sm text-muted-foreground">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-md bg-primary flex items-center justify-center">
              <Film className="w-4 h-4 text-primary-foreground" />
            </div>
            <span className="font-semibold text-foreground">CineTrack</span>
            <span className="text-muted-foreground/60">·</span>
            <span>Your personal cinema companion</span>
          </div>
          <div className="flex items-center gap-4">
            <span className="flex items-center gap-1.5">
              Powered by <span className="font-semibold text-foreground">TMDB</span> API
            </span>
            <span className="flex items-center gap-1">
              Built with <Heart className="w-3.5 h-3.5 fill-primary text-primary" />
            </span>
          </div>
        </div>
      </div>
    </footer>
  );
}
