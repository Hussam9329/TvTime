"use client";

import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { Star } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { motion } from "framer-motion";
import { SafeImage } from "@/components/media/safe-image";

interface RatingDialogProps {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  title: string;
  poster: string | null;
  onRate: (rating: number) => Promise<void> | void;
  onRemove?: () => Promise<void> | void;
  initialRating?: number | null;
  description?: string;
  submitLabel?: string;
}

export function RatingDialog({
  open,
  onOpenChange,
  title,
  poster,
  onRate,
  onRemove,
  initialRating = null,
  description = "This saves only your rating out of 100. It does not change Watchlist or Watched status.",
  submitLabel = "Save Rating",
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
      await onRate(rating);
      toast.success(`Rated ${rating}/100`);
      onOpenChange(false);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to save rating");
    } finally {
      setSubmitting(false);
    }
  };

  const ratingColor = rating >= 80 ? "text-emerald-400" : rating >= 60 ? "text-amber-400" : rating >= 40 ? "text-orange-400" : "text-rose-400";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Star className="w-5 h-5 text-amber-400 fill-amber-400" /> Rate this title
          </DialogTitle>
          <DialogDescription>
            {description}
          </DialogDescription>
        </DialogHeader>

        <div className="flex items-center gap-4 py-2">
          {poster && (
            <div className="relative w-16 h-24 rounded-md overflow-hidden flex-shrink-0">
              <SafeImage src={poster} alt={title} fill variant="poster" />
            </div>
          )}
          <div className="min-w-0">
            <h4 className="font-semibold text-sm line-clamp-2">{title}</h4>
            {/* Fix #8/#9: Show current rating when re-rating */}
            {isRerating && (
              <p className="text-xs text-amber-400 mt-1">Current rating: {safeInitialRating}/100</p>
            )}
          </div>
        </div>

        {/* Big rating display */}
        <div className="text-center py-4">
          <motion.div
            key={rating}
            initial={{ scale: 0.8, opacity: 0.5 }}
            animate={{ scale: 1, opacity: 1 }}
            className={`text-6xl font-extrabold ${ratingColor}`}
          >
            {rating}
            <span className="text-2xl text-muted-foreground">/100</span>
          </motion.div>
          <p className="text-xs text-muted-foreground mt-1">
            {rating >= 90 ? "Masterpiece!" : rating >= 80 ? "Excellent" : rating >= 70 ? "Very good" : rating >= 60 ? "Good" : rating >= 40 ? "Average" : rating >= 20 ? "Poor" : "Very bad"}
          </p>
        </div>

        {/* Slider */}
        <div className="px-2">
          <Slider
            value={[rating]}
            onValueChange={(v) => setRating(v[0])}
            min={0}
            max={100}
            step={1}
            className="w-full"
          />
          <div className="flex justify-between text-xs text-muted-foreground mt-1">
            <span>0</span>
            <span>50</span>
            <span>100</span>
          </div>
        </div>

        {/* Quick presets */}
        <div className="flex gap-2 flex-wrap justify-center">
          {[20, 40, 50, 60, 80, 100].map((v) => (
            <Button
              key={v}
              variant={rating === v ? "default" : "outline"}
              size="sm"
              className="h-7 text-xs"
              onClick={() => setRating(v)}
            >
              {v}
            </Button>
          ))}
        </div>

        <DialogFooter>
          {isRerating && onRemove && (
            <Button
              variant="ghost"
              size="sm"
              className="text-rose-400 hover:text-rose-300 mr-auto"
              disabled={submitting}
              onClick={async () => {
                try {
                  await onRemove();
                  onOpenChange(false);
                } catch {
                  toast.error("Failed to remove rating");
                }
              }}
            >
              Remove rating
            </Button>
          )}
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={handleSubmit} disabled={submitting}>
            {submitting ? "Saving..." : submitLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
