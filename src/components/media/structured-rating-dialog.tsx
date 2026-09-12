"use client";

import { useEffect, useMemo, useState } from "react";
import { Star } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Slider } from "@/components/ui/slider";
import { SafeImage } from "@/components/media/safe-image";
import { useWatchUndo } from "@/hooks/use-watch-undo";
import {
  buildPersonalRatingBreakdown,
  completedPersonalRatingCriteria,
  personalRatingCriteria,
  personalRatingLabel,
  personalRatingScore,
  validatePersonalRatingBreakdown,
  type PersonalRatingBreakdown,
  type PersonalRatingDraft,
  type PersonalRatingKey,
  type PersonalRatingKind,
} from "@/lib/personal-rating";

export type StructuredRatingResult = {
  score: number;
  breakdown: PersonalRatingBreakdown;
};

interface StructuredRatingDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  poster: string | null;
  kind: PersonalRatingKind;
  onRate: (result: StructuredRatingResult) => Promise<unknown> | unknown;
  initialBreakdown?: unknown;
  legacyInitialRating?: number | null;
  description?: string;
  submitLabel?: (score: number) => string;
  successMessage?: (score: number) => string;
}

function draftFromBreakdown(value: unknown, kind: PersonalRatingKind): PersonalRatingDraft {
  const validation = validatePersonalRatingBreakdown(value, kind);
  return validation.ok ? { ...validation.breakdown.criteria } : {};
}

export function StructuredRatingDialog({
  open,
  onOpenChange,
  title,
  poster,
  kind,
  onRate,
  initialBreakdown,
  legacyInitialRating = null,
  description,
  submitLabel = (score) => `Save Rating · ${score}/100`,
  successMessage = (score) => `Rated ${score}/100`,
}: StructuredRatingDialogProps) {
  const criteriaDefinitions = useMemo(() => personalRatingCriteria(kind), [kind]);
  const [draft, setDraft] = useState<PersonalRatingDraft>(() => draftFromBreakdown(initialBreakdown, kind));
  const [submitting, setSubmitting] = useState(false);
  const showWatchUndo = useWatchUndo();

  useEffect(() => {
    if (!open) return;
    setDraft(draftFromBreakdown(initialBreakdown, kind));
  }, [open, initialBreakdown, kind]);

  const completedCount = completedPersonalRatingCriteria(draft);
  const score = personalRatingScore(draft);
  const complete = completedCount === criteriaDefinitions.length;
  const hasStructuredInitial = validatePersonalRatingBreakdown(initialBreakdown, kind).ok;
  const isLegacy = !hasStructuredInitial && legacyInitialRating != null;
  const scoreColor = score >= 80
    ? "text-emerald-400"
    : score >= 60
      ? "text-amber-400"
      : score >= 40
        ? "text-orange-400"
        : "text-rose-400";

  const setCriterion = (key: PersonalRatingKey, value: number) => {
    const normalized = Math.max(0, Math.min(10, Math.round(value)));
    setDraft((current) => ({ ...current, [key]: normalized }));
  };

  const handleSubmit = async () => {
    const breakdown = buildPersonalRatingBreakdown(kind, draft);
    if (!breakdown) {
      toast.error("Complete all 10 rating criteria before saving.");
      return;
    }
    const finalScore = personalRatingScore(breakdown.criteria);
    setSubmitting(true);
    try {
      const result = await onRate({ score: finalScore, breakdown });
      showWatchUndo(successMessage(finalScore), result as { undoToken?: string | null } | null | undefined);
      onOpenChange(false);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to save rating");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="tvtime-structured-rating-dialog grid h-[100dvh] max-h-[100dvh] w-screen max-w-none grid-rows-[auto_minmax(0,1fr)_auto] gap-0 overflow-hidden rounded-none border-x-0 border-y border-border bg-card p-0 shadow-[var(--app-shadow-lg)] sm:h-auto sm:max-h-[min(94dvh,58rem)] sm:w-[min(48rem,calc(100vw-2rem))] sm:max-w-[48rem] sm:rounded-[1.1rem] sm:border">
        <DialogHeader className="static z-20 gap-3 border-b border-border/60 bg-card/95 px-4 py-4 pe-12 backdrop-blur-xl sm:px-6 sm:py-5 sm:pe-14">
          <div className="flex min-w-0 items-center gap-3.5">
            {poster ? (
              <div className="relative h-[4.7rem] w-[3.2rem] shrink-0 overflow-hidden rounded-xl border border-border/60 bg-muted shadow-md sm:h-[5.4rem] sm:w-[3.65rem]">
                <SafeImage src={poster} alt={title} fill variant="poster" />
              </div>
            ) : (
              <div className="flex h-[4.7rem] w-[3.2rem] shrink-0 items-center justify-center rounded-xl border border-border/60 bg-muted/50 text-muted-foreground sm:h-[5.4rem] sm:w-[3.65rem]">
                <Star className="h-5 w-5" />
              </div>
            )}
            <div className="min-w-0 flex-1">
              <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-amber-300/90">
                {kind === "movie" ? "Movie personal rating" : "Completed series personal rating"}
              </p>
              <DialogTitle className="mt-1 line-clamp-2 text-lg font-black leading-tight sm:text-xl">{title}</DialogTitle>
              <DialogDescription className="mt-1 text-xs leading-relaxed sm:text-sm">
                {description ?? (kind === "movie"
                  ? "Rate all 10 movie criteria. Their exact sum becomes your final score out of 100."
                  : "Rate the completed series across all 10 journey-wide criteria. Their exact sum becomes your final score out of 100.")}
              </DialogDescription>
            </div>
            <div className="hidden shrink-0 text-end sm:block" aria-live="polite">
              <div className={`text-4xl font-black tracking-[-0.05em] ${scoreColor}`}>{score}<span className="ms-1 text-base text-muted-foreground">/100</span></div>
              <p className="mt-0.5 text-[11px] font-semibold text-muted-foreground">{complete ? personalRatingLabel(score) : `${completedCount}/10 rated`}</p>
            </div>
          </div>

          <div className="flex items-center justify-between gap-3 rounded-xl border border-white/10 bg-white/[0.035] px-3.5 py-2.5 sm:hidden" aria-live="polite">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-muted-foreground">Your score</p>
              <p className="text-xs font-semibold text-muted-foreground">{complete ? personalRatingLabel(score) : `${completedCount}/10 criteria rated`}</p>
            </div>
            <div className={`text-3xl font-black tracking-[-0.05em] ${scoreColor}`}>{score}<span className="ms-1 text-sm text-muted-foreground">/100</span></div>
          </div>

          {isLegacy && (
            <div className="rounded-xl border border-amber-400/25 bg-amber-400/[0.08] px-3.5 py-2.5 text-xs leading-relaxed text-amber-100/90">
              Previous legacy rating: <strong>{legacyInitialRating}/100</strong>. No criterion scores were stored for it, so the 10 sliders remain empty until you re-rate this title.
            </div>
          )}
        </DialogHeader>

        <div className="min-h-0 overflow-y-auto overscroll-contain px-4 py-4 sm:px-6 sm:py-5">
          <div className="space-y-3.5 sm:space-y-4">
            {criteriaDefinitions.map((criterion, index) => {
              const value = draft[criterion.key];
              const rated = value !== undefined;
              return (
                <section
                  key={criterion.key}
                  className="rounded-2xl border border-white/10 bg-white/[0.025] p-3.5 sm:p-4"
                  aria-labelledby={`personal-rating-${criterion.key}`}
                >
                  <div dir="rtl" className="text-right">
                    <div className="flex items-start justify-between gap-3" dir="ltr">
                      <span className="mt-0.5 shrink-0 rounded-lg border border-white/10 bg-white/[0.04] px-2 py-1 text-[10px] font-black tabular-nums text-muted-foreground">
                        {String(index + 1).padStart(2, "0")}
                      </span>
                      <div className="min-w-0 flex-1 text-right" dir="rtl">
                        <h3 id={`personal-rating-${criterion.key}`} className="text-sm font-black leading-snug text-foreground sm:text-base">
                          {criterion.title}
                        </h3>
                        <p className="mt-1.5 text-[12px] font-medium leading-6 text-muted-foreground sm:text-[13px]">
                          {criterion.question}
                        </p>
                      </div>
                      <span className={`shrink-0 text-sm font-black tabular-nums ${rated ? "text-amber-300" : "text-muted-foreground"}`} dir="ltr">
                        {rated ? `${value}/10` : "—/10"}
                      </span>
                    </div>
                  </div>

                  <div className={`mt-3.5 ${rated ? "opacity-100" : "opacity-55"}`} dir="ltr">
                    <Slider
                      value={[value ?? 0]}
                      min={0}
                      max={10}
                      step={1}
                      onPointerDown={() => {
                        if (!rated) setCriterion(criterion.key, 0);
                      }}
                      onKeyDown={(event) => {
                        if (!rated && ["ArrowLeft", "ArrowRight", "Home", "End", "PageUp", "PageDown"].includes(event.key)) {
                          setCriterion(criterion.key, 0);
                        }
                      }}
                      onValueChange={(next) => setCriterion(criterion.key, next[0] ?? 0)}
                      aria-label={`${criterion.title}: rating from 0 to 10`}
                      className="w-full py-1 [--tvtime-slider-thumb-visual-size:1.15rem] [&_[data-slot=slider-track]]:h-2 [&_[data-slot=slider-thumb]]:size-5"
                    />
                    <div className="mt-1.5 flex justify-between text-[10px] font-bold tabular-nums text-muted-foreground">
                      <span>0</span>
                      <span>5</span>
                      <span>10</span>
                    </div>
                  </div>
                </section>
              );
            })}
          </div>
        </div>

        <DialogFooter className="static z-20 grid grid-cols-[0.7fr_1.3fr] gap-2.5 border-t border-border/60 bg-card/95 px-4 py-[max(0.85rem,env(safe-area-inset-bottom))] pt-3.5 backdrop-blur-xl sm:grid-cols-[0.8fr_1.35fr] sm:px-6 sm:py-4 [&>[data-slot=button]]:w-full">
          <Button type="button" variant="outline" className="min-h-11" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            type="button"
            className="h-auto min-h-11 whitespace-normal px-3 text-center leading-tight"
            onClick={handleSubmit}
            disabled={!complete || submitting}
            aria-busy={submitting}
          >
            {submitting ? "Saving..." : complete ? submitLabel(score) : `Complete all criteria · ${completedCount}/10`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
