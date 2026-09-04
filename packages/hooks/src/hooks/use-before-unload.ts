import { useCallback, useEffect } from "react";
import { isBrowser } from "../lib/is-browser";
import { useLatest } from "./use-latest";

/**
 * Warns the user when closing the tab or navigating away. Use for unsaved forms.
 * @param enabled - When false (or function returning false), the handler is not attached
 * @param message - Optional message; most modern browsers ignore it and show a generic warning
 */
export function useBeforeUnload(
  enabled: boolean | (() => boolean) = true,
  message?: string
): void {
  const enabledRef = useLatest(enabled);
  const messageRef = useLatest(message);

  // biome-ignore lint/correctness/useExhaustiveDependencies: refs provide stable handler
  const handler = useCallback((event: BeforeUnloadEvent) => {
    const finalEnabled =
      typeof enabledRef.current === "function"
        ? enabledRef.current()
        : enabledRef.current;
    if (!finalEnabled) {
      return;
    }
    event.preventDefault();
    if (messageRef.current) {
      event.returnValue = messageRef.current;
    }
  }, []);

  useEffect(() => {
    if (!isBrowser) {
      return;
    }
    const active = typeof enabled === "function" ? enabled() : enabled;
    if (!active) {
      return;
    }
    window.addEventListener("beforeunload", handler);
    return () => {
      window.removeEventListener("beforeunload", handler);
    };
  }, [enabled, handler]);
}
