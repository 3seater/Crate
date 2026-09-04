import { useMediaQuery } from "./use-media-query";

const MOBILE_QUERY = "(max-width: 767px)";

/** Returns true when viewport is mobile (≤767px). */
export function useMobile(): boolean {
  return useMediaQuery(MOBILE_QUERY);
}
