import { useState } from "react";
import { useIsomorphicLayoutEffect } from "./use-isomorphic-layout-effect";

/** Returns whether a media query matches. Uses false for SSR/initial paint to avoid hydration mismatch. */
export function useMediaQuery(mediaQueryString: string): boolean {
  const [isMatch, setIsMatch] = useState(false);

  useIsomorphicLayoutEffect(() => {
    const mql = window.matchMedia(mediaQueryString);
    setIsMatch(mql.matches);
    const listener = (e: MediaQueryListEvent) => setIsMatch(e.matches);
    mql.addEventListener("change", listener);
    return () => mql.removeEventListener("change", listener);
  }, [mediaQueryString]);

  return isMatch;
}
