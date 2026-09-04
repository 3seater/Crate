# Hooks Package

> Scope: `packages/hooks` (inherits root [AGENTS.md](../../AGENTS.md) unless noted)

Shared React hooks for Doji apps.

## Quick Facts

- **Package:** `@doji/hooks`
- **Commands:** `pnpm check-types` (from root or `--filter @doji/hooks`)
- **Peer:** React ^18 || ^19

## Purpose

Framework-agnostic or shared UI hooks used by multiple apps (e.g. web, docs). App-specific hooks (tRPC, Polymarket, Magic) stay in `apps/web/src/hooks/`.

## Structure

```
src/
├── lib/
│   ├── is-browser.ts
│   └── create-effect-with-target.ts
├── create-update-effect.ts
├── hooks/
│   ├── use-isomorphic-layout-effect.ts
│   ├── use-latest.ts
│   ├── use-memoized-fn.ts
│   ├── use-unmount.ts
│   ├── use-mount.ts
│   ├── use-raf-state.ts
│   ├── use-previous.ts
│   ├── use-toggle.ts
│   ├── use-boolean.ts
│   ├── use-debounce.ts
│   ├── use-debounce-fn.ts
│   ├── use-throttle-fn.ts
│   ├── use-measure.ts
│   ├── use-media-query.ts
│   ├── use-mobile.ts
│   ├── use-mounted-state.ts
│   ├── use-effect-with-target.ts
│   ├── use-event-listener.ts
│   ├── use-first-mount-state.ts
│   ├── use-before-unload.ts
│   ├── use-click-away.ts
│   ├── use-clipboard.ts
│   ├── use-window-size.ts
│   ├── use-update-effect.ts
│   ├── use-update.ts
│   ├── use-timeout.ts
│   ├── use-intersection.ts
│   ├── use-interval.ts
│   ├── use-lock-fn.ts
│   ├── use-document-visibility.ts
│   ├── use-counter.ts
│   └── use-hover.ts
└── index.ts    # Barrel export
```

## Usage

```typescript
import {
  useDebounce,
  useMediaQuery,
  useMobile,
  useCopyToClipboard,
  useClickAway,
  useBoolean,
  useUpdateEffect,
  useUpdate,
  useTimeout,
  useInterval,
  useLockFn,
  useDocumentVisibility,
  useCounter,
  useHover,
} from "@doji/hooks";
```

## New Hooks (from react-use)

| Hook | Purpose |
|------|---------|
| `useFirstMountState` | Returns true only on first render |
| `useMountedState` | Returns getter for whether component is mounted |
| `useBeforeUnload` | Warn user when closing tab or navigating away |
| `useRafState` | setState batched via requestAnimationFrame |
| `useWindowSize` | Window inner dimensions (width, height) |
| `useIntersection` | IntersectionObserver for visibility / lazy loading |
| `useMeasure` | ResizeObserver for element dimensions |

## New Hooks (from ahooks)

| Hook | Purpose |
|------|---------|
| `useUpdateEffect` | Effect that skips first run (runs only on deps change) |
| `useUpdate` | Force re-render |
| `useTimeout` | setTimeout with cleanup on unmount |
| `useInterval` | setInterval with cleanup, optional `immediate` |
| `useLockFn` | Prevents concurrent async execution (mutex) |
| `useDocumentVisibility` | Tab visibility (document.visibilityState) |
| `useCounter` | Numeric state with inc, dec, set, reset, min/max |
| `useHover` | Hover state for target element |

## Migrated from Web

- `use-debounce`, `use-media-query`, `use-mobile`, `use-copy-to-clipboard` — now in @doji/hooks

## Finish the Task

- [ ] Run `pnpm fix` before committing.
- [ ] Update this AGENTS.md if structure or exports change.
- [ ] Summarize changes in conventional commit form (e.g. `feat(hooks): ...`).

## Related

- [Web Hooks](../../apps/web/src/hooks/AGENTS.md)
- [Root AGENTS.md](../../AGENTS.md)
