import { useEffect } from "react";

/** Runs fn once when the component mounts. */
export function useMount(fn: () => void): void {
  // biome-ignore lint/correctness/useExhaustiveDependencies: mount-only, fn intentionally excluded
  useEffect(fn, []);
}
