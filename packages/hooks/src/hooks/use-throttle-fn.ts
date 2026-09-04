import type { ThrottleOptions } from "es-toolkit";
import { throttle } from "es-toolkit";
import { useMemo } from "react";
import { useLatest } from "./use-latest";
import { useUnmount } from "./use-unmount";

export type { ThrottleOptions } from "es-toolkit";

/** Returns a throttled function. */
export function useThrottleFn<Fn extends (...args: unknown[]) => unknown>(
  fn: Fn,
  throttleMs?: number,
  options?: ThrottleOptions
) {
  const fnRef = useLatest(fn);

  // biome-ignore lint/correctness/useExhaustiveDependencies: fnRef.current always latest via useLatest, stable identity preferred
  const throttledFn = useMemo(
    () =>
      throttle(
        (...args: Parameters<Fn>) => fnRef.current(...args),
        throttleMs ?? 1000,
        options
      ),
    []
  );

  useUnmount(() => throttledFn.cancel());

  return {
    run: throttledFn,
    cancel: throttledFn.cancel,
    flush: throttledFn.flush,
  };
}
