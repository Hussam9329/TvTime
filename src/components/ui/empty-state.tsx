"use client";

import { ReactNode } from "react";

interface EmptyStateProps {
  icon?: ReactNode;
  title: string;
  description?: string;
  action?: ReactNode;
  /** Optional className for the container */
  className?: string;
}

/**
 * EmptyState — friendly placeholder for empty collections, no-search-results,
 * no-data-yet states. Replaces the previous pattern of rendering an empty
 * grid that made the page look broken.
 *
 * Usage:
 *   <EmptyState
 *     icon={<Film className="w-12 h-12" />}
 *     title="Watchlist is empty"
 *     description="Start adding movies from the Discover page."
 *     action={<Button onClick={() => setView("discover")}>Explore movies</Button>}
 *   />
 */
export function EmptyState({ icon, title, description, action, className }: EmptyStateProps) {
  return (
    <div
      className={`flex flex-col items-center justify-center py-16 px-4 text-center ${className ?? ""}`}
    >
      {icon && (
        <div className="w-20 h-20 rounded-full bg-muted/40 flex items-center justify-center mb-4 text-muted-foreground">
          {icon}
        </div>
      )}
      <h3 className="text-lg font-bold mb-1.5">{title}</h3>
      {description && (
        <p className="text-sm text-muted-foreground max-w-sm mb-5 leading-relaxed">
          {description}
        </p>
      )}
      {action}
    </div>
  );
}
