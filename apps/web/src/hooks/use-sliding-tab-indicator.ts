"use client";

import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react";

export interface SlidingIndicatorStyle {
  left: number;
  width: number;
}

/**
 * Hook for a sliding tab underline that animates position when switching tabs.
 * Returns refs and style for a single underline element that moves to the active tab.
 *
 * @param extraDeps - Additional values that, when changed, trigger a re-measure
 *   (e.g. badge counts that widen a tab label after async load).
 */
export function useSlidingTabIndicator<T extends string>(
  _tabs: readonly T[],
  activeTab: T,
  extraDeps: readonly unknown[] = []
) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const tabRefsMap = useRef<Map<T, HTMLButtonElement | null>>(new Map());
  const [indicator, setIndicator] = useState<SlidingIndicatorStyle | null>(
    null
  );

  const setTabRef = useCallback(
    (tab: T) => (el: HTMLButtonElement | null) => {
      if (el) {
        tabRefsMap.current.set(tab, el);
      } else {
        tabRefsMap.current.delete(tab);
      }
    },
    []
  );

  const measure = useCallback(() => {
    const container = containerRef.current;
    const activeEl = tabRefsMap.current.get(activeTab);
    if (!(container && activeEl)) {
      return;
    }
    // Use offsetLeft/offsetWidth instead of getBoundingClientRect.
    // The container has position:relative so offsetLeft is relative to it,
    // making the measurement immune to ancestor CSS transforms (e.g. the
    // centered dialog's -translate-x/y-1/2 that shifts mid-animation or
    // when content height changes).
    setIndicator({
      left: activeEl.offsetLeft,
      width: activeEl.offsetWidth,
    });
  }, [activeTab]);

  useLayoutEffect(() => {
    measure();
  }, [measure, ...extraDeps]);

  // Re-measure when the container resizes (e.g. after a dialog open animation
  // finishes and the element reaches its final dimensions).
  useEffect(() => {
    const container = containerRef.current;
    if (!container) {
      return;
    }
    const ro = new ResizeObserver(() => measure());
    ro.observe(container);
    return () => ro.disconnect();
  }, [measure]);

  return { containerRef, setTabRef, indicator };
}
