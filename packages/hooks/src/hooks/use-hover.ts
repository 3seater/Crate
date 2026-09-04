import type { BasicTarget } from "../lib/create-effect-with-target";
import { useBoolean } from "./use-boolean";
import { useEventListener } from "./use-event-listener";

export interface UseHoverOptions {
  onChange?: (isHovering: boolean) => void;
  onEnter?: () => void;
  onLeave?: () => void;
}

/** Tracks hover state of target element. */
export function useHover(
  target: BasicTarget,
  options?: UseHoverOptions
): boolean {
  const { onEnter, onLeave, onChange } = options ?? {};
  const [state, { setTrue, setFalse }] = useBoolean(false);

  useEventListener(
    "mouseenter",
    () => {
      onEnter?.();
      setTrue();
      onChange?.(true);
    },
    { target }
  );

  useEventListener(
    "mouseleave",
    () => {
      onLeave?.();
      setFalse();
      onChange?.(false);
    },
    { target }
  );

  return state;
}
