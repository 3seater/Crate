import { useCallback, useEffect, useRef } from "react";

/** Returns a getter that returns true if the component is mounted. Use before setState in async callbacks. */
export function useMountedState(): () => boolean {
  const mountedRef = useRef(false);
  const get = useCallback(() => mountedRef.current, []);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  return get;
}
