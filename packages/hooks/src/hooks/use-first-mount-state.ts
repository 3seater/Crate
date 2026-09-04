import { useRef } from "react";

/** Returns true only on the first render, then false on subsequent renders. */
export function useFirstMountState(): boolean {
  const isFirst = useRef(true);

  if (isFirst.current) {
    isFirst.current = false;
    return true;
  }

  return false;
}
