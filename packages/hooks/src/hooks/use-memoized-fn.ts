import { useMemo, useRef } from "react";

/** Returns a stable function that always calls the latest fn. */
// biome-ignore lint/suspicious/noExplicitAny: stable callback identity
export function useMemoizedFn<T extends (...args: any[]) => any>(fn: T): T {
  const fnRef = useRef<T>(fn);
  fnRef.current = useMemo(() => fn, [fn]);

  const memoizedFn = useRef<T | null>(null);
  if (!memoizedFn.current) {
    memoizedFn.current = function (this: unknown, ...args: Parameters<T>) {
      return fnRef.current.apply(this, args);
    } as T;
  }

  return memoizedFn.current;
}
