"use client";

import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { Star } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { SafeImage } from "@/components/media/safe-image";
import { useWatchUndo } from "@/hooks/use-watch-undo";
import { ratingToneClass } from "@/lib/rating-tone";

const COPY = {
  en: {
    description: "This saves only your rating out of 100. It does not change Watchlist or Watched status.",
    submit: "Save Rating",
    success: (rating: number) => `Rated ${rating}/100`,
    failed: "Failed to save rating",
    heading: "Rate this title",
    nowRating: "Now rating",
    current: (rating: number) => `Current rating: ${rating}/100`,
    yourScore: "Your score",
    hint: "Drag the slider or choose a quick value.",
    quickValues: "Quick rating values",
    cancel: "Cancel",
    saving: "Saving...",
    labels: ["Masterpiece!", "Excellent", "Very good", "Good", "Average", "Poor", "Very bad"],
  },
  ar: {
    description: "يحفظ هذا تقييمك من 100 فقط، ولا يغيّر حالة قائمة المشاهدة أو المشاهدة.",
    submit: "حفظ التقييم",
    success: (rating: number) => `تم التقييم ${rating}/100`,
    failed: "تعذّر حفظ التقييم",
    heading: "قيّم هذا العمل",
    nowRating: "تقييم",
    current: (rating: number) => `تقييمك الحالي: ${rating}/100`,
    yourScore: "درجتك",
    hint: "حرّك المؤشر أو اختر قيمة سريعة.",
    quickValues: "قيم تقييم سريعة",
    cancel: "إلغاء",
    saving: "جارٍ الحفظ…",
    labels: ["تحفة!", "ممتاز", "جيد جدًا", "جيد", "متوسط", "ضعيف", "سيئ جدًا"],
  },
} as const;

interface RatingDialogProps {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  title: string;
  poster: string | null;
  onRate: (rating: number) => Promise<unknown> | unknown;
  initialRating?: number | null;
  description?: string;
  submitLabel?: string;
  successMessage?: (rating: number) => string;
  /** Copy language and text direction. Arabic titles pass "ar". */
  locale?: "en" | "ar";
}

export function RatingDialog({
  open,
  onOpenChange,
  title,
  poster,
  onRate,
  initialRating = null,
  description,
  submitLabel,
  successMessage,
  locale = "en",
}: RatingDialogProps) {
  const copy = COPY[locale];
  // Default to 50 (neutral) instead of 75 — the old default of 75 made it too
  // easy to accidentally save a high rating by just clicking "Save Rating"
  // without moving the slider. 50 forces the user to actively choose a rating.
  // Fix #9: When initialRating is provided (re-rating), use it as the starting
  // value so the user sees their current rating, not 50.
  const safeInitialRating = initialRating == null
    ? 50
    : Math.max(0, Math.min(100, Math.round(Number(initialRating))));
  const [rating, setRating] = useState(safeInitialRating);
  const [submitting, setSubmitting] = useState(false);
  const showWatchUndo = useWatchUndo();

  // Fix #9: When dialog opens, reset to the correct initial rating
  // (either the user's current rating or 50 for new ratings)
  const [lastOpen, setLastOpen] = useState(open);
  if (open !== lastOpen) {
    setLastOpen(open);
    if (open) setRating(safeInitialRating);
  }

  // Fix #8: Show "Current rating: X/100" when re-rating
  const isRerating = initialRating != null;

  const handleSubmit = async () => {
    setSubmitting(true);
    try {
      const result = await onRate(rating);
      showWatchUndo((successMessage ?? copy.success)(rating), result as { undoToken?: string | null } | null | undefined);
      onOpenChange(false);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : copy.failed);
    } finally {
      setSubmitting(false);
    }
  };

  const ratingColor = ratingToneClass(rating);
  const ratingLabel = copy.labels[rating >= 90 ? 0 : rating >= 80 ? 1 : rating >= 70 ? 2 : rating >= 60 ? 3 : rating >= 40 ? 4 : rating >= 20 ? 5 : 6];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent dir={locale === "ar" ? "rtl" : "ltr"} lang={locale} className="tvtime-rating-dialog gap-0 overflow-hidden rounded-2xl border-border bg-card p-0 shadow-[var(--app-shadow-lg)] sm:max-w-[32rem] sm:p-0">
        <DialogHeader className="relative top-auto z-0 gap-1.5 border-b border-border/60 bg-transparent px-5 py-5 pe-14 backdrop-blur-none supports-[backdrop-filter]:bg-transparent sm:px-6 sm:py-6 sm:pe-16">
          <DialogTitle className="flex items-center gap-3 text-xl leading-tight">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <Star className="h-5 w-5 fill-current" />
            </span>
            {copy.heading}
          </DialogTitle>
          <DialogDescription className="ps-[3.25rem] text-sm leading-relaxed">
            {description ?? copy.description}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5 px-5 py-5 sm:px-6 sm:py-6">
          <div className="flex min-w-0 items-center gap-3.5 border-b border-border/60 pb-5">
            {poster ? (
              <div className="relative h-[5.25rem] w-14 shrink-0 overflow-hidden rounded-xl border border-border/60 bg-muted shadow-md">
                <SafeImage src={poster} alt={title} fill variant="poster" />
              </div>
            ) : (
              <div className="flex h-[5.25rem] w-14 shrink-0 items-center justify-center rounded-xl border border-border/60 bg-muted/50 text-muted-foreground">
                <Star className="h-5 w-5" />
              </div>
            )}
            <div className="min-w-0 flex-1">
              <p className="mb-1 text-xs font-bold uppercase tracking-[0.14em] text-muted-foreground">{copy.nowRating}</p>
              <h4 dir="auto" className="line-clamp-2 text-base font-bold leading-snug text-foreground">{title}</h4>
              {isRerating && (
                <p className="mt-1.5 text-xs font-semibold text-primary">{copy.current(safeInitialRating)}</p>
              )}
            </div>
          </div>

          <div className="py-2 text-center" aria-live="polite">
            <div dir="ltr" className={`flex items-baseline justify-center font-black tracking-[-0.055em] ${ratingColor}`}>
              <span className="text-6xl sm:text-7xl">{rating}</span>
              <span className="ms-1.5 text-xl tracking-tight text-muted-foreground sm:text-2xl">/100</span>
            </div>
            <p className="mt-1 text-sm font-medium text-muted-foreground">
              {ratingLabel}
            </p>
          </div>

          <div className="space-y-4">
            <div className="flex items-end justify-between gap-3">
              <div>
                <p className="text-sm font-bold text-foreground">{copy.yourScore}</p>
                <p className="mt-0.5 text-xs text-muted-foreground">{copy.hint}</p>
              </div>
              <span dir="ltr" className={`shrink-0 text-sm font-extrabold tabular-nums ${ratingColor}`}>{rating}/100</span>
            </div>

            <div className="px-1" dir="ltr">
              <Slider
                value={[rating]}
                onValueChange={(value) => setRating(value[0])}
                min={0}
                max={100}
                step={1}
                aria-label="Personal rating out of 100"
                className="w-full [--tvtime-slider-thumb-visual-size:1.25rem] [&_[data-slot=slider-track]]:h-2 [&_[data-slot=slider-thumb]]:size-5"
              />
              <div className="mt-2 flex justify-between text-xs font-medium tabular-nums text-muted-foreground">
                <span>0</span>
                <span>50</span>
                <span>100</span>
              </div>
            </div>

            <div className="grid grid-cols-5 gap-2" aria-label={copy.quickValues} dir="ltr">
              {[20, 40, 60, 80, 100].map((value) => (
                <Button
                  key={value}
                  type="button"
                  variant={rating === value ? "default" : "outline"}
                  size="sm"
                  className="h-10 min-w-0 rounded-xl px-0 text-sm tabular-nums"
                  onClick={() => setRating(value)}
                  aria-pressed={rating === value}
                >
                  {value}
                </Button>
              ))}
            </div>
          </div>
        </div>

        <DialogFooter className="static z-0 grid grid-cols-[0.8fr_1.35fr] gap-3 border-t border-border/60 bg-muted/30 px-5 py-4 pt-4 backdrop-blur-none supports-[backdrop-filter]:bg-muted/30 sm:grid-cols-[0.8fr_1.35fr] sm:px-6 [&>[data-slot=button]]:w-full">
          <Button type="button" variant="outline" className="min-h-11" onClick={() => onOpenChange(false)}>
            {copy.cancel}
          </Button>
          <Button type="button" className="h-auto min-h-11 whitespace-normal px-4 text-center leading-tight" onClick={handleSubmit} disabled={submitting} aria-busy={submitting}>
            {submitting ? copy.saving : submitLabel ?? copy.submit}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
