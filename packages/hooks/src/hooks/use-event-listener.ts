import type { BasicTarget } from "../lib/create-effect-with-target";
import { getTargetElement } from "../lib/create-effect-with-target";
import { useEffectWithTarget } from "./use-effect-with-target";
import { useLatest } from "./use-latest";

type Noop = (...p: unknown[]) => void;

interface EventListenerOptions {
  capture?: boolean;
  enable?: boolean;
  once?: boolean;
  passive?: boolean;
  target?: BasicTarget<HTMLElement | Element | Window | Document>;
}

function useEventListener<K extends keyof HTMLElementEventMap>(
  eventName: K,
  handler: (ev: HTMLElementEventMap[K]) => void,
  options?: EventListenerOptions
): void;
function useEventListener<K extends keyof DocumentEventMap>(
  eventName: K,
  handler: (ev: DocumentEventMap[K]) => void,
  options?: EventListenerOptions
): void;
function useEventListener<K extends keyof WindowEventMap>(
  eventName: K,
  handler: (ev: WindowEventMap[K]) => void,
  options?: EventListenerOptions
): void;
function useEventListener(
  eventName: string | string[],
  handler: Noop,
  options?: EventListenerOptions
): void;
function useEventListener(
  eventName: string | string[],
  handler: Noop,
  options: EventListenerOptions = {}
): void {
  const { enable = true, target } = options;
  const resolvedTarget =
    target ?? (typeof window === "undefined" ? undefined : window);
  const handlerRef = useLatest(handler);

  useEffectWithTarget(
    () => {
      if (!(enable && resolvedTarget)) {
        return;
      }

      const targetElement = getTargetElement(resolvedTarget, window);
      if (!targetElement?.addEventListener) {
        return;
      }

      const eventListener = (event: Event) => handlerRef.current(event);
      const eventNameArray = Array.isArray(eventName) ? eventName : [eventName];

      for (const ev of eventNameArray) {
        targetElement.addEventListener(ev, eventListener, {
          capture: options.capture,
          once: options.once,
          passive: options.passive,
        });
      }

      return () => {
        for (const ev of eventNameArray) {
          targetElement.removeEventListener(ev, eventListener, {
            capture: options.capture,
          });
        }
      };
    },
    [eventName, options.capture, options.once, options.passive, enable],
    resolvedTarget
  );
}

export { useEventListener };
