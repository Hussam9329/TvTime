"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";

interface SafeImageProps extends Omit<React.ImgHTMLAttributes<HTMLImageElement>, "src"> {
  src?: string | null;
  fallbackSrc?: string;
  maxRetries?: number;
}

export function SafeImage({ src, alt, className, fallbackSrc = "/placeholder-poster.svg", maxRetries = 1, ...props }: SafeImageProps) {
  const normalizedSrc = src || fallbackSrc;
  const [retries, setRetries] = useState(0);
  const [prevSrc, setPrevSrc] = useState(normalizedSrc);
  const [usedFallback, setUsedFallback] = useState(false);

  // Reset retry state when the source changes (React "adjust state when prop changes" pattern)
  if (normalizedSrc !== prevSrc) {
    setPrevSrc(normalizedSrc);
    setRetries(0);
    setUsedFallback(false);
  }

  // Compute the current src based on retry count
  const currentSrc = usedFallback
    ? fallbackSrc
    : retries === 0
    ? normalizedSrc
    : `${normalizedSrc}${normalizedSrc.includes("?") ? "&" : "?"}retry=${retries}`;

  return (
    <img
      {...props}
      src={currentSrc}
      alt={alt || ""}
      className={cn("bg-muted", className)}
      onError={(event) => {
        props.onError?.(event);
        if (retries < maxRetries && src) {
          setRetries((value) => value + 1);
          return;
        }
        if (!usedFallback) setUsedFallback(true);
      }}
    />
  );
}
