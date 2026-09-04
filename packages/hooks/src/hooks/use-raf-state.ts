import type { Dispatch, SetStateAction } from "react";
import { useCallback, useRef, useState } from "react";
import { useUnmount } from "./use-unmount";

/** setState that batches updates inside requestAnimationFrame. Useful for resize/scroll handlers. */
export function useRafState<S>(
  initialState: S | (() => S)
): [S, Dispatch<SetStateAction<S>>] {
  const frame = useRef<number>(0);
  const [state, setState] = useState(initialState);

  const setRafState = useCallback((value: S | ((prevState: S) => S)) => {
    cancelAnimationFrame(frame.current);
    frame.current = requestAnimationFrame(() => {
      setState(value);
    });
  }, []);

  useUnmount(() => {
    cancelAnimationFrame(frame.current);
  });

  return [state, setRafState];
}
