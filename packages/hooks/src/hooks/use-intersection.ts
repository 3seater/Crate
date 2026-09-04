import type { RefCallback } from "react";
import { useCallback, useEffect, useState } from "react";
import { isBrowser } from "../lib/is-browser";

export interface UseIntersectionOptions extends IntersectionObserverInit {}

/**
 * Observes an element with IntersectionObserver. Returns [ref, entry].
 * Attach ref to the element to observe. Use for lazy loading, infinite scroll.
 */
export function useIntersection<T extends HTMLElement = HTMLElement>(
  options: UseIntersectionOptions = {}
): [RefCallback<T | null>, IntersectionObserverEntry | null] {
  const [element, setElement] = useState<T | null>(null);
  const [entry, setEntry] = useState<IntersectionObserverEntry | null>(null);

  const ref = useCallback((node: T | null) => {
    setElement(node);
  }, []);

  useEffect(() => {
    if (!isBrowser || typeof IntersectionObserver !== "function" || !element) {
      return;
    }
    const observer = new IntersectionObserver(
      (entries) => {
        setEntry(entries[0] ?? null);
      },
      {
        threshold: options.threshold,
        root: options.root,
        rootMargin: options.rootMargin,
      }
    );
    observer.observe(element);
    return () => {
      observer.disconnect();
      setEntry(null);
    };
  }, [element, options.threshold, options.root, options.rootMargin]);

  return [ref, entry];
}
