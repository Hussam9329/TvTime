"use client";

import { useEffect, useState } from "react";

export const MOBILE_EXPERIENCE_QUERY = "(max-width: 767px), (orientation: landscape) and (max-width: 932px) and (max-height: 500px) and (pointer: coarse)";

export function useMobileViewport() {
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const media = window.matchMedia(MOBILE_EXPERIENCE_QUERY);
    const sync = () => setIsMobile(media.matches);
    sync();
    media.addEventListener("change", sync);
    return () => media.removeEventListener("change", sync);
  }, []);

  return isMobile;
}
