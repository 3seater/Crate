import type { RefCallback } from "react";
import { useCallback, useMemo, useState } from "react";
import { isBrowser } from "../lib/is-browser";
import { useIsomorphicLayoutEffect } from "./use-isomorphic-layout-effect";

export type UseMeasureRect = Pick<
  DOMRectReadOnly,
  "x" | "y" | "top" | "left" | "right" | "bottom" | "height" | "width"
>;

const defaultState: UseMeasureRect = {
  x: 0,
  y: 0,
  width: 0,
  height: 0,
  top: 0,
  left: 0,
  bottom: 0,
  right: 0,
};

/**
 * Tracks element dimensions via ResizeObserver. Returns [ref, rect].
 * Attach ref to the element to measure. Falls back to default rect on server or when ResizeObserver is unavailable.
 */
export function useMeasure<E extends Element = Element>(): [
  RefCallback<E | null>,
  UseMeasureRect,
] {
  const [element, setElement] = useState<E | null>(null);
  const [rect, setRect] = useState<UseMeasureRect>(defaultState);

  const observer = useMemo(() => {
    if (!isBrowser || typeof ResizeObserver === "undefined") {
      return null;
    }
    return new ResizeObserver((entries) => {
      const entry = entries[0];
      if (entry) {
        const { x, y, width, height, top, left, bottom, right } =
          entry.contentRect;
        setRect({ x, y, width, height, top, left, bottom, right });
      }
    });
  }, []);

  const ref = useCallback((node: E | null) => {
    setElement(node);
  }, []);

  useIsomorphicLayoutEffect(() => {
    if (!(element && observer)) {
      return;
    }
    observer.observe(element);
    return () => {
      observer.disconnect();
    };
  }, [element, observer]);

  return [ref, rect];
}
