"use client";

import { SafeImage } from "@/components/media/safe-image";
import { img } from "@/lib/tmdb";

/** Decorative artwork only; catalogue queries and visible copy stay with the view. */
export function CatalogueArtwork({ backdropPath }: { backdropPath?: string | null }) {
  return (
    <div className="tvtime-catalogue-artwork" aria-hidden="true">
      {backdropPath && (
        <SafeImage
          src={img(backdropPath, "w1280")}
          alt=""
          fill
          variant="backdrop"
          sizes="(max-width: 767px) 100vw, 70vw"
        />
      )}
    </div>
  );
}
