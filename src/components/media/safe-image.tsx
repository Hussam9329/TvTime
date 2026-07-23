"use client";

import Image from "next/image";
import { useState } from "react";
import { cn } from "@/lib/utils";

/**
 * SafeImage — next/image wrapper with fallback support.
 *
 * Replaces the 34 plain <img> tags across the app with a single component
 * that:
 * - Serves AVIF/WebP via next/image's automatic format negotiation
 * - Generates appropriate `sizes` per variant so the browser picks the
 *   smallest source that still looks sharp on the user's viewport
 * - Falls back to a local SVG placeholder on error (no broken-image icon)
 * - Skips next/image optimization for YouTube thumbnails (their CDN does
 *   not support content negotiation and would 404 on the AVIF variant)
 *
 * Usage:
 *   <SafeImage src={img(path, "w342")} alt="..." fill variant="poster" />
 *   <SafeImage src={img(path, "w1280")} alt="..." fill variant="backdrop" priority />
 *
 * When `fill` is true, the parent element MUST have `position: relative`
 * (or absolute/fixed) and explicit dimensions. This matches the existing
 * pattern of `className="w-full h-full object-cover"` inside a sized
 * container.
 */

type ImageVariant = "poster" | "backdrop" | "profile" | "still" | "logo" | "youtube";

const DEFAULT_SIZES: Record<ImageVariant, string> = {
  // Posters in a 6-col grid on desktop, 2-col on mobile
  poster:
    "(max-width: 640px) 50vw, (max-width: 1024px) 33vw, (max-width: 1280px) 20vw, (max-width: 1536px) 16vw, 220px",
  // Backdrops span the full content width
  backdrop: "(max-width: 768px) 100vw, (max-width: 1280px) 90vw, 1280px",
  // Profile thumbnails are small and fixed-ish
  profile: "(max-width: 768px) 64px, 96px",
  // Episode stills in a 2-col grid
  still: "(max-width: 768px) 100vw, (max-width: 1024px) 50vw, 400px",
  // Provider logos are tiny
  logo: "48px",
  // YouTube thumbnails
  youtube: "(max-width: 768px) 100vw, 480px",
};

interface SafeImageProps {
  /** Full image URL. Pass null/undefined/"" to render the placeholder. */
  src?: string | null;
  /** Alt text. Falls back to "" when undefined (matches <img> behavior). */
  alt?: string;
  /** Image category — controls the default `sizes` hint. Default: "poster". */
  variant?: ImageVariant;
  /**
   * When true, the image fills its parent (parent must be position:relative
   * with explicit dimensions). When false, width/height must be provided
   * or the variant's intrinsic dimensions are used.
   */
  fill?: boolean;
  /** Explicit width (non-fill mode only). */
  width?: number;
  /** Explicit height (non-fill mode only). */
  height?: number;
  className?: string;
  /** Eager-load + LCP hint for above-the-fold images. */
  priority?: boolean;
  /** Override the responsive sizes hint. */
  sizes?: string;
  /** Fallback image when src is empty or errors. Default: placeholder SVG. */
  fallbackSrc?: string;
  /** Override loading behavior. next/image defaults to "lazy" (or "eager" when priority). */
  loading?: "eager" | "lazy";
  /** Optional fetchPriority hint for above-the-fold images. */
  fetchPriority?: "high" | "low" | "auto";
  /** Hint to the browser about decoding. Passed through to next/image. */
  decoding?: "async" | "sync" | "auto";
}

export function SafeImage({
  src,
  alt,
  variant = "poster",
  fill = false,
  width,
  height,
  className,
  priority = false,
  sizes,
  fallbackSrc = "/placeholder-poster.svg",
  loading,
  fetchPriority,
  decoding,
}: SafeImageProps) {
  const [failureStage, setFailureStage] = useState<0 | 1 | 2>(0);

  const normalizedSrc = src && src.length > 0 ? src : fallbackSrc;
  const finalSrc = failureStage === 2 ? fallbackSrc : normalizedSrc;
  const finalSizes = sizes ?? DEFAULT_SIZES[variant];

  // YouTube's CDN does not support content-type negotiation — it would 404
  // when next/image asks for AVIF. Use unoptimized mode for those URLs.
  const isYoutube = finalSrc.includes("img.youtube.com");
  // Local placeholder SVGs are also better unoptimized (they're already tiny).
  const isLocalAsset = finalSrc.startsWith("/") || finalSrc.startsWith("data:");

  const sharedProps = {
    src: finalSrc,
    className: cn(fill && "object-cover", className),
    priority,
    sizes: fill ? finalSizes : undefined,
    onError: () => setFailureStage((stage) => stage === 0 ? 1 : 2),
    draggable: !isLocalAsset,
    onDragStart: (event: React.DragEvent<HTMLImageElement>) => {
      if (isLocalAsset) return;
      event.dataTransfer.setData("text/uri-list", normalizedSrc);
      event.dataTransfer.setData("text/plain", normalizedSrc);
      event.dataTransfer.effectAllowed = "copyLink";
    },
    loading,
    ...(fetchPriority ? { fetchPriority } : {}),
    ...(decoding ? { decoding } : {}),
    ...(isYoutube || isLocalAsset || failureStage === 1 ? { unoptimized: true } : {}),
  } as const;

  if (fill) {
    return <Image key={`${finalSrc}:${failureStage}`} {...sharedProps} alt={alt ?? ""} fill />;
  }

  // Non-fill mode: use explicit dims or fall back to the variant's intrinsic
  // size. The CSS `w-full h-full object-cover` on the <img> will still
  // control the display size.
  const intrinsicDims = INTRINSIC_DIMS[variant];
  return (
    <Image
      key={`${finalSrc}:${failureStage}`}
      {...sharedProps}
      alt={alt ?? ""}
      width={width ?? intrinsicDims.w}
      height={height ?? intrinsicDims.h}
    />
  );
}

const INTRINSIC_DIMS: Record<ImageVariant, { w: number; h: number }> = {
  poster: { w: 342, h: 513 },     // 2:3
  backdrop: { w: 1280, h: 720 },  // 16:9
  profile: { w: 185, h: 278 },    // 2:3 (TMDB profile aspect)
  still: { w: 500, h: 281 },      // 16:9
  logo: { w: 92, h: 92 },         // square-ish
  youtube: { w: 480, h: 360 },    // 4:3
};
