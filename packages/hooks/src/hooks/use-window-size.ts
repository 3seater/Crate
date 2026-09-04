import { useEffect } from "react";
import { isBrowser } from "../lib/is-browser";
import { useLatest } from "./use-latest";
import { useRafState } from "./use-raf-state";

export interface UseWindowSizeOptions {
  initialHeight?: number;
  initialWidth?: number;
  onChange?: (width: number, height: number) => void;
}

/**
 * Returns current window inner dimensions. Uses requestAnimationFrame for resize updates.
 */
export function useWindowSize(options: UseWindowSizeOptions = {}): {
  width: number;
  height: number;
} {
  const {
    initialWidth = Number.POSITIVE_INFINITY,
    initialHeight = Number.POSITIVE_INFINITY,
    onChange,
  } = options;
  const onChangeRef = useLatest(onChange);
  const [state, setState] = useRafState({
    width: isBrowser ? window.innerWidth : initialWidth,
    height: isBrowser ? window.innerHeight : initialHeight,
  });

  // biome-ignore lint/correctness/useExhaustiveDependencies: onChange via ref to avoid re-subscribing on callback change
  useEffect(() => {
    if (!isBrowser) {
      return;
    }
    const handler = () => {
      const width = window.innerWidth;
      const height = window.innerHeight;
      setState({ width, height });
      onChangeRef.current?.(width, height);
    };
    window.addEventListener("resize", handler);
    return () => {
      window.removeEventListener("resize", handler);
    };
  }, [setState]);

  return state;
}
