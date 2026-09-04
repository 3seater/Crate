import { useEffect, useLayoutEffect } from "react";
import { isBrowser } from "../lib/is-browser";

/** useLayoutEffect on client, useEffect on server (SSR-safe). */
export const useIsomorphicLayoutEffect = isBrowser
  ? useLayoutEffect
  : useEffect;
