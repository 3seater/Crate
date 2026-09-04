import { useMemo } from "react";
import { useToggle } from "./use-toggle";

export interface BooleanActions {
  set: (value: boolean) => void;
  setFalse: () => void;
  setTrue: () => void;
  toggle: () => void;
}

/** Boolean state with setTrue, setFalse, toggle helpers. */
export function useBoolean(defaultValue = false): [boolean, BooleanActions] {
  const [state, actions] = useToggle(defaultValue);

  const boolActions = useMemo(
    () => ({
      set: (value: boolean) => actions.set(value),
      setTrue: () => actions.set(true),
      setFalse: () => actions.set(false),
      toggle: () => actions.toggle(),
    }),
    [actions]
  );

  return [state, boolActions];
}
