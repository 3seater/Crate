import type { DependencyList, EffectCallback } from "react";
import { useRef } from "react";

type EffectHookType = typeof import("react").useEffect;

/** Creates an effect hook that skips the first run (only runs on updates). */
export function createUpdateEffect(
  hook: EffectHookType
): (effect: EffectCallback, deps?: DependencyList) => void {
  return (effect: EffectCallback, deps?: DependencyList) => {
    const isMounted = useRef(false);

    hook(
      () => () => {
        isMounted.current = false;
      },
      []
    );

    hook(() => {
      if (isMounted.current) {
        return effect();
      }
      isMounted.current = true;
    }, deps);
  };
}
