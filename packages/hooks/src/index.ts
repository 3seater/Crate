/**
 * @doji/hooks — Shared React hooks for Doji apps.
 */

// Update effect (skips first run)
export { createUpdateEffect } from "./create-update-effect";
export { useBeforeUnload } from "./hooks/use-before-unload";
export { type BooleanActions, useBoolean } from "./hooks/use-boolean";
export { useClickAway } from "./hooks/use-click-away";
// Clipboard
export {
  type UseClipboardOptions,
  type UseClipboardReturn,
  useClipboard,
  useClipboard as useCopyToClipboard,
} from "./hooks/use-clipboard";
// Counter
export {
  type CounterActions,
  type CounterValueParam,
  type UseCounterOptions,
  useCounter,
} from "./hooks/use-counter";
// Timing
export { useDebounce } from "./hooks/use-debounce";
export {
  type DebounceOptions,
  useDebounceFn,
} from "./hooks/use-debounce-fn";
// Visibility
export { useDocumentVisibility } from "./hooks/use-document-visibility";
export { useEffectWithTarget } from "./hooks/use-effect-with-target";
export { useEventListener } from "./hooks/use-event-listener";
export { useFirstMountState } from "./hooks/use-first-mount-state";
export {
  type UseHoverOptions,
  useHover,
} from "./hooks/use-hover";
export {
  type UseIntersectionOptions,
  useIntersection,
} from "./hooks/use-intersection";
export {
  type UseIntervalOptions,
  useInterval,
} from "./hooks/use-interval";
// Foundational
export { useIsomorphicLayoutEffect } from "./hooks/use-isomorphic-layout-effect";
export { useLatest } from "./hooks/use-latest";
// Async
export { useLockFn } from "./hooks/use-lock-fn";
export { type UseMeasureRect, useMeasure } from "./hooks/use-measure";
// DOM / Events
export { useMediaQuery } from "./hooks/use-media-query";
export { useMemoizedFn } from "./hooks/use-memoized-fn";
export { useMobile, useMobile as useIsMobile } from "./hooks/use-mobile";
export { useMount } from "./hooks/use-mount";
export { useMountedState } from "./hooks/use-mounted-state";
// State
export { type ShouldUpdateFunc, usePrevious } from "./hooks/use-previous";
export { useRafState } from "./hooks/use-raf-state";
export {
  type ThrottleOptions,
  useThrottleFn,
} from "./hooks/use-throttle-fn";
// Timers
export { useTimeout } from "./hooks/use-timeout";
export { type ToggleActions, useToggle } from "./hooks/use-toggle";
export { useUnmount } from "./hooks/use-unmount";
// Force update
export { useUpdate } from "./hooks/use-update";
export { useUpdateEffect } from "./hooks/use-update-effect";
export {
  type UseWindowSizeOptions,
  useWindowSize,
} from "./hooks/use-window-size";
export {
  type BasicTarget,
  createEffectWithTarget,
  getTargetElement,
} from "./lib/create-effect-with-target";
// Lib
export { isBrowser } from "./lib/is-browser";
