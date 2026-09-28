"use client";

import { ReactNode, useId } from "react";
import { AlertTriangle, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface ErrorStateProps {
  title?: string;
  description?: string;
  /** Called by the retry button. When omitted, no retry button is shown. */
  onRetry?: () => void;
  retryLabel?: string;
  /** Extra actions rendered next to the retry button. */
  action?: ReactNode;
  /** Arabic copy and RTL direction for Arabic catalogue worlds. */
  arabic?: boolean;
  compact?: boolean;
  className?: string;
}

/**
 * Shared recovery state for failed loads. Pairs with EmptyState so every view
 * explains a failure the same way instead of rendering a blank page or an
 * empty row that looks like "no content".
 */
export function ErrorState({
  title,
  description,
  onRetry,
  retryLabel,
  action,
  arabic = false,
  compact = false,
  className,
}: ErrorStateProps) {
  const id = useId();
  const titleId = `${id}-title`;
  const descriptionId = `${id}-description`;
  const resolvedTitle = title ?? (arabic ? "تعذّر تحميل المحتوى" : "Couldn’t load this content");
  const resolvedDescription =
    description ??
    (arabic
      ? "حدث خطأ في الاتصال. تحقق من الشبكة ثم أعد المحاولة."
      : "Something went wrong while loading. Check your connection and try again.");

  return (
    <div
      role="alert"
      aria-labelledby={titleId}
      aria-describedby={descriptionId}
      dir={arabic ? "rtl" : undefined}
      lang={arabic ? "ar" : undefined}
      className={cn(
        "feedback-state feedback-state--error flex flex-col items-center justify-center px-4 text-center",
        compact ? "py-8" : "py-14",
        className,
      )}
    >
      <div
        aria-hidden="true"
        className={cn(
          "feedback-state__icon mb-4 flex items-center justify-center rounded-2xl bg-destructive/10 text-destructive",
          compact ? "size-14" : "size-20",
        )}
      >
        <AlertTriangle className={compact ? "size-6" : "size-8"} />
      </div>
      <h3 id={titleId} className="feedback-state__title mb-1.5 text-lg font-bold">
        {resolvedTitle}
      </h3>
      <p
        id={descriptionId}
        className="feedback-state__description mb-5 max-w-md text-sm leading-relaxed text-muted-foreground"
      >
        {resolvedDescription}
      </p>
      {(onRetry || action) && (
        <div className="mt-1 flex flex-wrap justify-center gap-2">
          {onRetry && (
            <Button type="button" variant="outline" onClick={onRetry}>
              <RefreshCw aria-hidden="true" />
              {retryLabel ?? (arabic ? "إعادة المحاولة" : "Try again")}
            </Button>
          )}
          {action}
        </div>
      )}
    </div>
  );
}
