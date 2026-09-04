import { useCallback, useEffect, useRef } from "react";
import { useMemoizedFn } from "./use-memoized-fn";

/** setTimeout with automatic cleanup on unmount. Returns clear function. */
export function useTimeout(fn: () => void, delay?: number): () => void {
  const timerCallback = useMemoizedFn(fn);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clear = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  useEffect(() => {
    if (typeof delay !== "number" || delay < 0) {
      return;
    }
    timerRef.current = setTimeout(timerCallback, delay);
    return clear;
  }, [delay, timerCallback, clear]);

  return clear;
}
