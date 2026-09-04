import { useCallback, useRef } from "react";

/** Wraps an async function so only one execution runs at a time. Prevents double-submit. */
export function useLockFn<P extends unknown[] = unknown[], V = unknown>(
  fn: (...args: P) => Promise<V>
): (...args: P) => Promise<V | undefined> {
  const lockRef = useRef(false);

  return useCallback(
    async (...args: P): Promise<V | undefined> => {
      if (lockRef.current) {
        return;
      }
      lockRef.current = true;
      try {
        return await fn(...args);
      } finally {
        lockRef.current = false;
      }
    },
    [fn]
  );
}
