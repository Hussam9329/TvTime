"use client";

import { Star } from "lucide-react";
import { useState } from "react";
import { cn } from "@/lib/utils";

interface RatingStarsProps {
  value: number; // 0-10
  onChange?: (value: number) => void;
  size?: "sm" | "md" | "lg";
  readOnly?: boolean;
  showValue?: boolean;
}

export function RatingStars({ value, onChange, size = "md", readOnly = false, showValue = false }: RatingStarsProps) {
  const [hover, setHover] = useState<number | null>(null);
  const sizes = {
    sm: "w-3.5 h-3.5",
    md: "w-5 h-5",
    lg: "w-7 h-7",
  };
  // 5 stars, each = 2 points
  const display = hover ?? value;
  const filled = display / 2;

  return (
    <div className="flex items-center gap-1">
      <div className="flex items-center gap-0.5">
        {Array.from({ length: 5 }).map((_, i) => {
          const starValue = (i + 1) * 2;
          const isFull = filled >= i + 1;
          const isHalf = !isFull && filled > i && filled < i + 1;
          return (
            <button
              key={i}
              type="button"
              disabled={readOnly}
              className={cn("relative transition-transform", !readOnly && "hover:scale-105 cursor-pointer", readOnly && "cursor-default")}
              onMouseEnter={() => !readOnly && setHover(starValue)}
              onMouseLeave={() => !readOnly && setHover(null)}
              onClick={() => !readOnly && onChange?.(starValue === value ? 0 : starValue)}
              aria-label={`Rate ${starValue} out of 10`}
            >
              <Star
                className={cn(
                  sizes[size],
                  isFull || isHalf ? "fill-amber-400 text-amber-400" : "fill-transparent text-muted-foreground/40"
                )}
              />
              {isHalf && (
                <Star
                  className={cn(sizes[size], "absolute top-0 left-0 fill-amber-400 text-amber-400")}
                  style={{ clipPath: "inset(0 50% 0 0)" }}
                />
              )}
            </button>
          );
        })}
      </div>
      {showValue && (
        <span className="text-sm font-medium text-amber-400 ml-1">
          {value > 0 ? value.toFixed(1) : "—"}
        </span>
      )}
    </div>
  );
}
