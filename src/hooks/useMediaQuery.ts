"use client";

import { useEffect, useState } from "react";

/** SSR-safe media query hook. Returns `undefined` until mounted so callers can
 *  fall back to CSS-only responsive rendering for the first paint. */
export function useMediaQuery(query: string): boolean | undefined {
  const [matches, setMatches] = useState<boolean | undefined>(undefined);
  useEffect(() => {
    const mq = window.matchMedia(query);
    const update = () => setMatches(mq.matches);
    update();
    mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
  }, [query]);
  return matches;
}

export const MOBILE_QUERY = "(max-width: 767px)";

export function useIsMobile(): boolean | undefined {
  return useMediaQuery(MOBILE_QUERY);
}
