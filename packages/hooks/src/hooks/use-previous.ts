import { useRef } from "react";

export type ShouldUpdateFunc<T> = (prev?: T, next?: T) => boolean;

const defaultShouldUpdate = <T>(a?: T, b?: T) => !Object.is(a, b);

/** Returns the previous value, updated when shouldUpdate(prev, next) is true. */
export function usePrevious<T>(
  state: T,
  shouldUpdate: ShouldUpdateFunc<T> = defaultShouldUpdate
): T | undefined {
  const prevRef = useRef<T>(undefined as T | undefined);
  const curRef = useRef<T>(undefined as T | undefined);

  if (shouldUpdate(curRef.current, state)) {
    prevRef.current = curRef.current;
    curRef.current = state;
  }

  return prevRef.current;
}
