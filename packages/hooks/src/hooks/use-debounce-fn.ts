import type { DebounceOptions } from "es-toolkit";
import { debounce } from "es-toolkit";
import { useMemo } from "react";
import { useLatest } from "./use-latest";
import { useUnmount } from "./use-unmount";

export type { DebounceOptions } from "es-toolkit";

/** Returns a debounced function. */
export function useDebounceFn<Fn extends (...args: unknown[]) => unknown>(
  fn: Fn,
  debounceMs?: number,
  options?: DebounceOptions
) {
  const fnRef = useLatest(fn);

  // biome-ignore lint/correctness/useExhaustiveDependencies: fnRef.current always latest via useLatest, stable identity preferred
  const debouncedFn = useMemo(
    () =>
      debounce(
        (...args: Parameters<Fn>) => fnRef.current(...args),
        debounceMs ?? 1000,
        options
      ),
    []
  );

  useUnmount(() => debouncedFn.cancel());

  return {
    run: debouncedFn,
    cancel: debouncedFn.cancel,
    flush: debouncedFn.flush,
  };
}
