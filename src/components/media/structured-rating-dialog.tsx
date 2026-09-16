"use client";

import { useEffect, useId, useMemo, useState } from "react";
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
  isDirectPersonalRating,
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
  breakdown: PersonalRatingBreakdown | null;
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
  const [mode, setMode] = useState<"direct" | "criteria">(() => validatePersonalRatingBreakdown(initialBreakdown, kind).ok ? "criteria" : "direct");
  const [directInput, setDirectInput] = useState(() => isDirectPersonalRating(legacyInitialRating) ? String(legacyInitialRating) : "");
  const [submitting, setSubmitting] = useState(false);
  const directInputId = useId();
  const showWatchUndo = useWatchUndo();

  useEffect(() => {
    if (!open) return;
    setDraft(draftFromBreakdown(initialBreakdown, kind));
    const initial = validatePersonalRatingBreakdown(initialBreakdown, kind);
    setMode(initial.ok ? "criteria" : "direct");
    setDirectInput(initial.ok ? String(initial.score) : isDirectPersonalRating(legacyInitialRating) ? String(legacyInitialRating) : "");
  }, [open, initialBreakdown, kind, legacyInitialRating]);

  const completedCount = completedPersonalRatingCriteria(draft);
  const directScore = directInput.trim() === "" ? null : Number(directInput);
  const directValid = isDirectPersonalRating(directScore);
  const score = mode === "direct" ? (directValid ? directScore : 0) : personalRatingScore(draft);
  const complete = mode === "direct" ? directValid : completedCount === criteriaDefinitions.length;
  const displayScore = mode === "direct" && !directValid ? "—" : score;
  const progressLabel = complete ? personalRatingLabel(score) : mode === "direct" ? "أدخل تقييمك من 0 إلى 100" : `${completedCount}/10 rated`;
  const hasStructuredInitial = validatePersonalRatingBreakdown(initialBreakdown, kind).ok;
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
    if (submitting) return;
    const breakdown = mode === "criteria" ? buildPersonalRatingBreakdown(kind, draft) : null;
    if (mode === "direct" ? !directValid : !breakdown) {
      toast.error(mode === "direct" ? "Enter a whole-number rating from 0 to 100." : "Complete all 10 rating criteria before saving.");
      return;
    }
    const finalScore = breakdown ? personalRatingScore(breakdown.criteria) : score;
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
    <Dialog open={open} onOpenChange={(next) => { if (!submitting) onOpenChange(next); }}>
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
                {description ?? "قيّم مباشرة من 100 أو جاوب على الأسئلة العشرة."}
              </DialogDescription>
            </div>
            <div className="hidden shrink-0 text-end sm:block" aria-live="polite">
              <div className={`text-4xl font-black tracking-[-0.05em] ${scoreColor}`}>{displayScore}<span className="ms-1 text-base text-muted-foreground">/100</span></div>
              <p className="mt-0.5 text-[11px] font-semibold text-muted-foreground">{progressLabel}</p>
            </div>
          </div>

          <div className="flex items-center justify-between gap-3 rounded-xl border border-white/10 bg-white/[0.035] px-3.5 py-2.5 sm:hidden" aria-live="polite">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-muted-foreground">Your score</p>
              <p className="text-xs font-semibold text-muted-foreground">{progressLabel}</p>
            </div>
            <div className={`text-3xl font-black tracking-[-0.05em] ${scoreColor}`}>{displayScore}<span className="ms-1 text-sm text-muted-foreground">/100</span></div>
          </div>

          <div role="group" aria-label="طريقة التقييم" dir="rtl" className="grid grid-cols-2 gap-2">
            <Button type="button" variant={mode === "direct" ? "default" : "outline"} aria-pressed={mode === "direct"} disabled={submitting} className="h-auto min-h-11 whitespace-normal px-2 text-xs leading-5 sm:text-sm" onClick={() => setMode("direct")}>
              تقييم مباشر /100
            </Button>
            <Button type="button" variant={mode === "criteria" ? "default" : "outline"} aria-pressed={mode === "criteria"} disabled={submitting} className="h-auto min-h-11 whitespace-normal px-2 text-xs leading-5 sm:text-sm" onClick={() => setMode("criteria")}>
              الأسئلة العشرة
            </Button>
          </div>

          {mode === "criteria" && !hasStructuredInitial && legacyInitialRating != null && (
            <div className="rounded-xl border border-amber-400/25 bg-amber-400/[0.08] px-3.5 py-2.5 text-xs leading-relaxed text-amber-100/90">
              Your current rating is <strong>{legacyInitialRating}/100</strong>. Complete all 10 criteria to replace it with a detailed rating.
            </div>
          )}
        </DialogHeader>

        <div className="min-h-0 overflow-y-auto overscroll-contain px-4 py-4 sm:px-6 sm:py-5">
          {mode === "direct" ? (
            <div className="mx-auto max-w-md space-y-6 py-5 sm:py-8">
              <div className="space-y-3 text-center">
                <label htmlFor={directInputId} className="block text-base font-bold" dir="rtl">تقييمك من 100</label>
                <div className="flex items-center justify-center gap-3" dir="ltr">
                  <input
                    id={directInputId}
                    type="number"
                    inputMode="numeric"
                    min={0}
                    max={100}
                    step={1}
                    placeholder="—"
                    value={directInput}
                    onChange={(event) => setDirectInput(event.target.value)}
                    onKeyDown={(event) => { if (event.key === "Enter") { event.preventDefault(); void handleSubmit(); } }}
                    disabled={submitting}
                    aria-invalid={directInput !== "" && !directValid}
                    aria-describedby={`${directInputId}-hint`}
                    className="h-20 w-36 rounded-2xl border border-border bg-background px-3 text-center text-4xl font-black tabular-nums outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  />
                  <span className="text-2xl font-bold text-muted-foreground">/100</span>
                </div>
                <p id={`${directInputId}-hint`} className={`text-sm ${directInput !== "" && !directValid ? "text-rose-400" : "text-muted-foreground"}`} dir="rtl">
                  أدخل رقمًا صحيحًا من 0 إلى 100، أو حرّك المؤشر.
                </p>
              </div>
              <div dir="ltr">
                <Slider
                  value={[directValid ? directScore : 0]}
                  min={0}
                  max={100}
                  step={1}
                  disabled={submitting}
                  onPointerDown={() => { if (!directValid) setDirectInput("0"); }}
                  onKeyDown={(event) => { if (!directValid && ["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown", "Home", "End", "PageUp", "PageDown"].includes(event.key)) setDirectInput("0"); }}
                  onValueChange={(next) => setDirectInput(String(next[0] ?? 0))}
                  aria-label="التقييم المباشر من 0 إلى 100"
                  className="py-3 [&_[data-slot=slider-track]]:h-2 [&_[data-slot=slider-thumb]]:size-6"
                />
                <div className="mt-1 flex justify-between text-xs font-bold text-muted-foreground"><span>0</span><span>50</span><span>100</span></div>
              </div>
            </div>
          ) : <div className="space-y-3.5 sm:space-y-4">
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
                      disabled={submitting}
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
          </div>}
        </div>

        <DialogFooter className="static z-20 grid grid-cols-[0.7fr_1.3fr] gap-2.5 border-t border-border/60 bg-card/95 px-4 py-[max(0.85rem,env(safe-area-inset-bottom))] pt-3.5 backdrop-blur-xl sm:grid-cols-[0.8fr_1.35fr] sm:px-6 sm:py-4 [&>[data-slot=button]]:w-full">
          <Button type="button" variant="outline" className="min-h-11" disabled={submitting} onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            type="button"
            className="h-auto min-h-11 whitespace-normal px-3 text-center leading-tight"
            onClick={handleSubmit}
            disabled={!complete || submitting}
            aria-busy={submitting}
          >
            {submitting ? "Saving..." : complete ? submitLabel(score) : mode === "direct" ? "أدخل تقييمك من 100" : `Complete all criteria · ${completedCount}/10`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
