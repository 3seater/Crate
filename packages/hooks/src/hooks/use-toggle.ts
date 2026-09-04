import { useMemo, useReducer } from "react";

export interface ToggleActions<T> {
  set: (value: T) => void;
  setLeft: () => void;
  setRight: () => void;
  toggle: () => void;
}

function useToggle<_T = boolean>(): [boolean, ToggleActions<boolean>];
function useToggle<T>(defaultValue: T): [T, ToggleActions<T>];
function useToggle<T, U>(
  defaultValue: T,
  reverseValue: U
): [T | U, ToggleActions<T | U>];
function useToggle<D, R>(
  defaultValue: D = false as unknown as D,
  reverseValue?: R
) {
  const [state, dispatch] = useReducer(
    (
      state: D | R,
      action:
        | { type: "toggle" }
        | { type: "set"; payload: D | R }
        | { type: "setLeft" }
        | { type: "setRight" }
    ) => {
      const reverseValueOrigin = (
        reverseValue === undefined ? !defaultValue : reverseValue
      ) as D | R;

      switch (action.type) {
        case "toggle":
          return state === defaultValue ? reverseValueOrigin : defaultValue;
        case "set":
          return action.payload;
        case "setLeft":
          return defaultValue;
        case "setRight":
          return reverseValueOrigin;
        default:
          return state;
      }
    },
    defaultValue
  );

  return [
    state,
    useMemo(
      () => ({
        toggle: () => dispatch({ type: "toggle" }),
        set: (value: D | R) => dispatch({ type: "set", payload: value }),
        setLeft: () => dispatch({ type: "setLeft" }),
        setRight: () => dispatch({ type: "setRight" }),
      }),
      []
    ),
  ] as const;
}

export { useToggle };
