import { useEffect } from "react";
import { useLatest } from "./use-latest";

/** Runs fn when the component unmounts. */
export function useUnmount(fn: () => void): void {
  const fnRef = useLatest(fn);
  // biome-ignore lint/correctness/useExhaustiveDependencies: fnRef.current always latest, unmount-only
  useEffect(
    () => () => {
      fnRef.current();
    },
    []
  );
}
