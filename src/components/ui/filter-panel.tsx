import type { ReactNode } from "react";
import { RotateCcw, SlidersHorizontal } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type FilterPanelProps = {
  title?: ReactNode;
  description?: ReactNode;
  activeCount?: number;
  activeLabel?: string;
  resetLabel?: string;
  onReset?: () => void;
  children: ReactNode;
  className?: string;
  contentClassName?: string;
};

export function FilterPanel({
  title = "Filters",
  description,
  activeCount = 0,
  activeLabel = "active",
  resetLabel = "Reset all",
  onReset,
  children,
  className,
  contentClassName,
}: FilterPanelProps) {
  return (
    <section
      className={cn(
        "tvtime-filter-panel glass overflow-hidden rounded-2xl border border-border/60 bg-card/70 shadow-sm",
        className,
      )}
    >
      <div className="tvtime-filter-panel-header flex flex-col gap-3 border-b border-border/50 px-3 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-4">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2 text-sm font-semibold">
            <SlidersHorizontal className="h-4 w-4 shrink-0 text-primary" />
            <span>{title}</span>
            {activeCount > 0 && (
              <Badge variant="secondary" className="h-5 text-[10px] tabular-nums">
                {activeCount} {activeLabel}
              </Badge>
            )}
          </div>
          {description && (
            <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{description}</p>
          )}
        </div>

        {onReset && activeCount > 0 && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-8 shrink-0 self-start text-xs sm:self-auto"
            onClick={onReset}
          >
            <RotateCcw className="mr-1.5 h-3.5 w-3.5" />
            {resetLabel}
          </Button>
        )}
      </div>

      <div className={cn("tvtime-filter-panel-content space-y-4 p-3 sm:p-4", contentClassName)}>{children}</div>
    </section>
  );
}

type FilterSectionProps = {
  title?: ReactNode;
  description?: ReactNode;
  children: ReactNode;
  divided?: boolean;
  className?: string;
  contentClassName?: string;
};

export function FilterSection({
  title,
  description,
  children,
  divided = false,
  className,
  contentClassName,
}: FilterSectionProps) {
  return (
    <div className={cn("tvtime-filter-section space-y-2.5", divided && "border-t border-border/50 pt-4", className)}>
      {(title || description) && (
        <div>
          {title && (
            <h3 className="text-[11px] font-bold uppercase tracking-[0.14em] text-muted-foreground">
              {title}
            </h3>
          )}
          {description && (
            <p className="mt-1 text-xs leading-relaxed text-muted-foreground/80">{description}</p>
          )}
        </div>
      )}
      <div className={contentClassName}>{children}</div>
    </div>
  );
}

type FilterGridProps = {
  children: ReactNode;
  className?: string;
};

export function FilterGrid({ children, className }: FilterGridProps) {
  return (
    <div className={cn("tvtime-filter-grid grid grid-cols-1 gap-2 sm:grid-cols-2", className)}>
      {children}
    </div>
  );
}

type FilterFieldProps = {
  label: ReactNode;
  description?: ReactNode;
  children: ReactNode;
  className?: string;
};

export function FilterField({ label, description, children, className }: FilterFieldProps) {
  return (
    <div className={cn("tvtime-filter-field min-w-0 space-y-1.5", className)}>
      <div className="px-0.5">
        <div className="text-xs font-medium text-foreground/80">{label}</div>
        {description && <div className="mt-0.5 text-[11px] text-muted-foreground">{description}</div>}
      </div>
      <div className="min-w-0 [&>*]:w-full">{children}</div>
    </div>
  );
}
