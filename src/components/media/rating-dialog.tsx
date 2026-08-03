"use client";

import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { Star } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { SafeImage } from "@/components/media/safe-image";
import { useWatchUndo } from "@/hooks/use-watch-undo";

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
}

export function RatingDialog({
  open,
  onOpenChange,
  title,
  poster,
  onRate,
  initialRating = null,
  description = "This saves only your rating out of 100. It does not change Watchlist or Watched status.",
  submitLabel = "Save Rating",
  successMessage = (rating) => `Rated ${rating}/100`,
}: RatingDialogProps) {
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
      showWatchUndo(successMessage(rating), result as { undoToken?: string | null } | null | undefined);
      onOpenChange(false);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to save rating");
    } finally {
      setSubmitting(false);
    }
  };

  const ratingColor = rating >= 80 ? "text-emerald-400" : rating >= 60 ? "text-amber-400" : rating >= 40 ? "text-orange-400" : "text-rose-400";
  const ratingLabel = rating >= 90 ? "Masterpiece!" : rating >= 80 ? "Excellent" : rating >= 70 ? "Very good" : rating >= 60 ? "Good" : rating >= 40 ? "Average" : rating >= 20 ? "Poor" : "Very bad";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="tvtime-rating-dialog gap-0 overflow-hidden rounded-[1.6rem] border-white/10 bg-[linear-gradient(155deg,rgba(24,27,40,0.99),rgba(10,13,22,0.99))] p-0 shadow-[0_32px_90px_rgba(0,0,0,0.58)] sm:max-w-[32rem] sm:p-0">
        <DialogHeader className="relative top-auto z-0 gap-1.5 border-b border-white/[0.08] bg-transparent px-5 py-5 pe-14 backdrop-blur-none supports-[backdrop-filter]:bg-transparent sm:px-6 sm:py-6 sm:pe-16">
          <DialogTitle className="flex items-center gap-3 text-xl leading-tight">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-amber-400/10 text-amber-300">
              <Star className="h-5 w-5 fill-current" />
            </span>
            Rate this title
          </DialogTitle>
          <DialogDescription className="ps-[3.25rem] text-sm leading-relaxed">
            {description}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5 px-5 py-5 sm:px-6 sm:py-6">
          <div className="flex min-w-0 items-center gap-3.5 border-b border-white/[0.07] pb-5">
            {poster ? (
              <div className="relative h-[5.25rem] w-14 shrink-0 overflow-hidden rounded-xl border border-white/10 bg-muted shadow-[0_10px_24px_rgba(0,0,0,0.3)]">
                <SafeImage src={poster} alt={title} fill variant="poster" />
              </div>
            ) : (
              <div className="flex h-[5.25rem] w-14 shrink-0 items-center justify-center rounded-xl border border-white/10 bg-white/[0.04] text-muted-foreground">
                <Star className="h-5 w-5" />
              </div>
            )}
            <div className="min-w-0 flex-1">
              <p className="mb-1 text-[11px] font-bold uppercase tracking-[0.14em] text-muted-foreground">Now rating</p>
              <h4 className="line-clamp-2 text-base font-bold leading-snug text-foreground">{title}</h4>
              {isRerating && (
                <p className="mt-1.5 text-xs font-semibold text-amber-300">Current rating: {safeInitialRating}/100</p>
              )}
            </div>
          </div>

          <div className="py-2 text-center" aria-live="polite">
            <div className={`flex items-baseline justify-center font-black tracking-[-0.055em] ${ratingColor}`}>
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
                <p className="text-sm font-bold text-foreground">Your score</p>
                <p className="mt-0.5 text-xs text-muted-foreground">Drag the slider or choose a quick value.</p>
              </div>
              <span className={`shrink-0 text-sm font-extrabold tabular-nums ${ratingColor}`}>{rating}/100</span>
            </div>

            <div className="px-1">
              <Slider
                value={[rating]}
                onValueChange={(value) => setRating(value[0])}
                min={0}
                max={100}
                step={1}
                aria-label="Personal rating out of 100"
                className="w-full [&_[data-slot=slider-track]]:h-2 [&_[data-slot=slider-thumb]]:size-5"
              />
              <div className="mt-2 flex justify-between text-[11px] font-medium tabular-nums text-muted-foreground">
                <span>0</span>
                <span>50</span>
                <span>100</span>
              </div>
            </div>

            <div className="grid grid-cols-5 gap-2" aria-label="Quick rating values">
              {[20, 40, 60, 80, 100].map((value) => (
                <Button
                  key={value}
                  type="button"
                  variant={rating === value ? "default" : "outline"}
                  size="sm"
                  className="h-9 min-w-0 rounded-xl px-0 text-sm tabular-nums"
                  onClick={() => setRating(value)}
                  aria-pressed={rating === value}
                >
                  {value}
                </Button>
              ))}
            </div>
          </div>
        </div>

        <DialogFooter className="static z-0 grid grid-cols-[0.8fr_1.35fr] gap-3 border-t border-white/[0.08] bg-white/[0.025] px-5 py-4 pt-4 backdrop-blur-none supports-[backdrop-filter]:bg-white/[0.025] sm:grid-cols-[0.8fr_1.35fr] sm:px-6 [&>[data-slot=button]]:w-full">
          <Button type="button" variant="outline" className="min-h-11" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button type="button" className="h-auto min-h-11 whitespace-normal px-4 text-center leading-tight" onClick={handleSubmit} disabled={submitting} aria-busy={submitting}>
            {submitting ? "Saving..." : submitLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
