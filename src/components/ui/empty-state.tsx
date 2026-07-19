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
      role="status"
      aria-live="polite"
      className={`feedback-state feedback-state--empty flex flex-col items-center justify-center px-4 py-14 text-center ${className ?? ""}`}
    >
      {icon && (
        <div className="feedback-state__icon mb-4 flex size-20 items-center justify-center rounded-2xl bg-muted/45 text-muted-foreground">
          {icon}
        </div>
      )}
      <h3 className="feedback-state__title mb-1.5 text-lg font-bold">{title}</h3>
      {description && (
        <p className="feedback-state__description mb-5 max-w-md text-sm leading-relaxed text-muted-foreground">
          {description}
        </p>
      )}
      {action}
    </div>
  );
}
