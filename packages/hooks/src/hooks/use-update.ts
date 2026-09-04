import { useState } from "react";
import { useMemoizedFn } from "./use-memoized-fn";

/** Returns a stable function that forces a re-render. */
export function useUpdate(): () => void {
  const [, setState] = useState({});
  return useMemoizedFn(() => setState({}));
}
