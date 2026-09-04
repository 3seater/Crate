import type { DependencyList, EffectCallback, RefObject } from "react";
import { useEffect, useRef } from "react";
import { isBrowser } from "./is-browser";

type TargetValue<T> = T | undefined | null;
type TargetType = HTMLElement | Element | Window | Document;

export type BasicTarget<T extends TargetType = Element> =
  | (() => TargetValue<T>)
  | TargetValue<T>
  | RefObject<TargetValue<T>>;

export function getTargetElement<T extends TargetType>(
  target: BasicTarget<T>,
  defaultElement?: T
): TargetValue<T> | undefined {
  if (!isBrowser) {
    return;
  }
  if (!target) {
    return defaultElement;
  }

  if (typeof target === "function") {
    return target();
  }
  if ("current" in target) {
    return target.current;
  }
  return target as TargetValue<T>;
}

function elementsEqual(
  a: (TargetValue<Element> | null)[],
  b: (TargetValue<Element> | null)[]
): boolean {
  if (a.length !== b.length) {
    return false;
  }
  return a.every((el, i) => el === b[i]);
}

export function createEffectWithTarget(
  useEffectType: typeof import("react").useEffect
) {
  return (
    effect: EffectCallback,
    deps: DependencyList,
    target: BasicTarget<TargetType> | BasicTarget<TargetType>[]
  ) => {
    const hasInitRef = useRef(false);
    const lastElementRef = useRef<(TargetValue<Element> | null)[]>([]);
    const lastDepsRef = useRef<DependencyList>([]);
    const unLoadRef = useRef<ReturnType<EffectCallback>>(undefined);

    useEffectType(() => {
      const targets = Array.isArray(target) ? target : [target];
      const els = targets.map((item) =>
        getTargetElement(item as BasicTarget<Element>)
      );

      if (!hasInitRef.current) {
        hasInitRef.current = true;
        lastElementRef.current = els;
        lastDepsRef.current = deps;
        unLoadRef.current = effect();
        return;
      }

      const depsChanged =
        deps.length !== lastDepsRef.current.length ||
        deps.some((d, i) => d !== lastDepsRef.current[i]);

      if (!elementsEqual(els, lastElementRef.current) || depsChanged) {
        unLoadRef.current?.();
        lastElementRef.current = els;
        lastDepsRef.current = deps;
        unLoadRef.current = effect();
      }
    });

    useEffect(
      () => () => {
        unLoadRef.current?.();
        hasInitRef.current = false;
      },
      []
    );
  };
}
