import type { DebounceOptions } from "es-toolkit";
import { useEffect, useState } from "react";
import { useDebounceFn } from "./use-debounce-fn";

/** Debounces a value. Useful for search inputs. */
export function useDebounce<T>(
  value: T,
  debounceMs?: number,
  options?: DebounceOptions
): T {
  const [debouncedValue, setDebouncedValue] = useState<T>(value);

  const { run } = useDebounceFn(
    () => {
      setDebouncedValue(value);
    },
    debounceMs,
    options
  );

  // biome-ignore lint/correctness/useExhaustiveDependencies: value must trigger run
  useEffect(() => run(), [value, run]);

  return debouncedValue;
}
