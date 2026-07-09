"use client";

import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { Star } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { motion } from "framer-motion";

interface RatingDialogProps {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  title: string;
  poster: string | null;
  onRate: (rating: number) => Promise<void> | void;
}

export function RatingDialog({ open, onOpenChange, title, poster, onRate }: RatingDialogProps) {
  // Default to 50 (neutral) instead of 75 — the old default of 75 made it too
  // easy to accidentally save a high rating by just clicking "Save Rating"
  // without moving the slider. 50 forces the user to actively choose a rating.
  const [rating, setRating] = useState(50);
  const [submitting, setSubmitting] = useState(false);

  // Reset to neutral default each time the dialog opens, so a previous rating
  // doesn't leak into the next session.
  // (Adjust state when prop changes pattern — fires when `open` toggles true.)
  const [lastOpen, setLastOpen] = useState(open);
  if (open !== lastOpen) {
    setLastOpen(open);
    if (open) setRating(50);
  }

  const handleSubmit = async () => {
    setSubmitting(true);
    try {
      await onRate(rating);
      toast.success(`Rated ${rating}/100`);
      onOpenChange(false);
    } catch {
      toast.error("Failed to save rating");
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
            <Star className="w-5 h-5 text-amber-400 fill-amber-400" /> Mark as watched & rate
          </DialogTitle>
          <DialogDescription>
            Saving will mark this as watched and store your rating out of 100. Drag the slider or pick a preset.
          </DialogDescription>
        </DialogHeader>

        <div className="flex items-center gap-4 py-2">
          {poster && (
            <img src={poster} alt={title} className="w-16 h-24 rounded-md object-cover flex-shrink-0" />
          )}
          <div className="min-w-0">
            <h4 className="font-semibold text-sm line-clamp-2">{title}</h4>
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
          {[20, 40, 60, 80, 100].map((v) => (
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
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={handleSubmit} disabled={submitting}>
            {submitting ? "Saving..." : "Save Rating"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
