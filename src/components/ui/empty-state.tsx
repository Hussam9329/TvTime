"use client";

import { ReactNode, useId } from "react";
import { cn } from "@/lib/utils";

interface EmptyStateProps {
  icon?: ReactNode;
  title: string;
  description?: string;
  action?: ReactNode;
  className?: string;
}

/**
 * Friendly placeholder for empty collections, no-search-results, and
 * no-data-yet states. The labelled status region is announced once when the
 * state replaces loaded content.
 */
export function EmptyState({ icon, title, description, action, className }: EmptyStateProps) {
  const id = useId();
  const titleId = `${id}-title`;
  const descriptionId = description ? `${id}-description` : undefined;

  return (
    <div
      role="status"
      aria-live="polite"
      aria-labelledby={titleId}
      aria-describedby={descriptionId}
      className={cn(
        "feedback-state feedback-state--empty flex flex-col items-center justify-center px-4 py-14 text-center",
        className,
      )}
    >
      {icon && (
        <div
          aria-hidden="true"
          className="feedback-state__icon mb-4 flex size-20 items-center justify-center rounded-2xl bg-muted/45 text-muted-foreground"
        >
          {icon}
        </div>
      )}
      <h3 id={titleId} className="feedback-state__title mb-1.5 text-lg font-bold">
        {title}
      </h3>
      {description && (
        <p
          id={descriptionId}
          className="feedback-state__description mb-5 max-w-md text-sm leading-relaxed text-muted-foreground"
        >
          {description}
        </p>
      )}
      {action && <div className="mt-1 flex flex-wrap justify-center gap-2">{action}</div>}
    </div>
  );
}
