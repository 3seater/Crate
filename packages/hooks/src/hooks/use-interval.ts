import { useCallback, useEffect, useRef } from "react";
import { useMemoizedFn } from "./use-memoized-fn";

export interface UseIntervalOptions {
  immediate?: boolean;
}

/** setInterval with automatic cleanup on unmount. Returns clear function. */
export function useInterval(
  fn: () => void,
  delay?: number,
  options: UseIntervalOptions = {}
): () => void {
  const { immediate = false } = options;
  const timerCallback = useMemoizedFn(fn);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const clear = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  useEffect(() => {
    if (typeof delay !== "number" || delay < 0) {
      return;
    }
    if (immediate) {
      timerCallback();
    }
    timerRef.current = setInterval(timerCallback, delay);
    return clear;
  }, [delay, immediate, timerCallback, clear]);

  return clear;
}
