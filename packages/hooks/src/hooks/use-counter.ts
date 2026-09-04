import { useState } from "react";
import { useMemoizedFn } from "./use-memoized-fn";

export interface UseCounterOptions {
  max?: number;
  min?: number;
}

export interface CounterActions {
  dec: (delta?: number) => void;
  inc: (delta?: number) => void;
  reset: () => void;
  set: (value: number | ((c: number) => number)) => void;
}

export type CounterValueParam = number | ((c: number) => number);

function clamp(val: number, min?: number, max?: number): number {
  let target = val;
  if (typeof max === "number") {
    target = Math.min(max, target);
  }
  if (typeof min === "number") {
    target = Math.max(min, target);
  }
  return target;
}

/** Numeric counter with inc, dec, set, reset and optional min/max. */
export function useCounter(
  initialValue = 0,
  options: UseCounterOptions = {}
): [number, CounterActions] {
  const { min, max } = options;

  const [current, setCurrent] = useState(() => clamp(initialValue, min, max));

  const setValue = useMemoizedFn((value: CounterValueParam) => {
    setCurrent((c) => {
      const target = typeof value === "function" ? value(c) : value;
      return clamp(target, min, max);
    });
  });

  const actions: CounterActions = {
    inc: useMemoizedFn((delta = 1) => setValue((c) => c + delta)),
    dec: useMemoizedFn((delta = 1) => setValue((c) => c - delta)),
    set: setValue,
    reset: useMemoizedFn(() => setValue(initialValue)),
  };

  return [current, actions];
}
