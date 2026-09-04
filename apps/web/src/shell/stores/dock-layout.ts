import { logger } from "@doji/logger/client";
import { create } from "zustand";
import { persist } from "zustand/middleware";
import {
  clampDockWidthForLayout,
  clampDockWidthForViewport,
  DOCK_WIDTH_DEFAULT,
  DOCK_WIDTH_DEFAULT_RATIO,
} from "@/shell/responsive-sizing";
import { invalidateStorageCache } from "@/utils/cached-storage";

export {
  DOCK_WIDTH_DEFAULT,
  DOCK_WIDTH_MAX,
  DOCK_WIDTH_MIN,
} from "@/shell/responsive-sizing";

export type DockableWidgetId =
  | "wallet-tracker"
  | "activity"
  | "watchlist"
  | "portfolio";
export type DockSide = "left" | "right";

export const DOCKABLE_WIDGET_IDS: DockableWidgetId[] = [
  "wallet-tracker",
  "activity",
  "watchlist",
  "portfolio",
];

export const DOCK_LAYOUT_STORAGE_KEY = "doji-dock-layout-storage";

export function clampDockWidth(n: number): number {
  const viewportWidth =
    typeof window === "undefined"
      ? Number.POSITIVE_INFINITY
      : window.innerWidth;
  return clampDockWidthForViewport(n, viewportWidth);
}

function getDockViewportWidth(): number {
  return typeof window === "undefined"
    ? Number.POSITIVE_INFINITY
    : window.innerWidth;
}

function normalizePersistedWidths(
  widths: Partial<Record<DockableWidgetId, number>>,
  leftSlot: DockableWidgetId | null,
  rightSlot: DockableWidgetId | null
): Record<DockableWidgetId, number> {
  const viewportWidth = getDockViewportWidth();
  const leftRaw = leftSlot ? (widths[leftSlot] ?? DEFAULT_WIDTHS[leftSlot]) : 0;
  const rightRaw = rightSlot
    ? (widths[rightSlot] ?? DEFAULT_WIDTHS[rightSlot])
    : 0;
  const leftNormalized =
    leftSlot == null
      ? 0
      : clampDockWidthForLayout(leftRaw, viewportWidth, rightRaw);
  const rightNormalized =
    rightSlot == null
      ? 0
      : clampDockWidthForLayout(rightRaw, viewportWidth, leftNormalized);
  const next = { ...DEFAULT_WIDTHS };
  for (const id of DOCKABLE_WIDGET_IDS) {
    if (leftSlot === id) {
      next[id] = leftNormalized;
      continue;
    }
    if (rightSlot === id) {
      next[id] = rightNormalized;
      continue;
    }
    next[id] = clampDockWidth(widths[id] ?? DEFAULT_WIDTHS[id]);
  }
  return next;
}

function normalizeRatios(
  ratios: Partial<Record<DockableWidgetId, number>>
): Record<DockableWidgetId, number> {
  const next = {} as Record<DockableWidgetId, number>;
  for (const id of DOCKABLE_WIDGET_IDS) {
    const candidate = ratios[id];
    next[id] =
      candidate != null && Number.isFinite(candidate) && candidate > 0
        ? candidate
        : DOCK_WIDTH_DEFAULT_RATIO;
  }
  return next;
}

function computeWidthFromRatio(ratio: number, viewportWidth: number): number {
  if (!Number.isFinite(viewportWidth) || viewportWidth <= 0) {
    return DOCK_WIDTH_DEFAULT;
  }
  return clampDockWidthForViewport(
    Math.round(viewportWidth * ratio),
    viewportWidth
  );
}

function normalizeWidthsForSlots(
  viewportWidth: number,
  leftSlot: DockableWidgetId | null,
  rightSlot: DockableWidgetId | null,
  ratios: Record<DockableWidgetId, number>
): Partial<Record<DockableWidgetId, number>> {
  const next: Partial<Record<DockableWidgetId, number>> = {};
  const desiredLeft = leftSlot
    ? computeWidthFromRatio(ratios[leftSlot], viewportWidth)
    : 0;
  const desiredRight = rightSlot
    ? computeWidthFromRatio(ratios[rightSlot], viewportWidth)
    : 0;
  const clampedLeft = leftSlot
    ? clampDockWidthForLayout(desiredLeft, viewportWidth, desiredRight)
    : 0;
  const clampedRight = rightSlot
    ? clampDockWidthForLayout(desiredRight, viewportWidth, clampedLeft)
    : 0;
  if (leftSlot) {
    next[leftSlot] = clampedLeft;
  }
  if (rightSlot) {
    next[rightSlot] = clampedRight;
  }
  return next;
}

const DEFAULT_WIDTHS: Record<DockableWidgetId, number> = {
  "wallet-tracker": DOCK_WIDTH_DEFAULT,
  activity: DOCK_WIDTH_DEFAULT,
  watchlist: DOCK_WIDTH_DEFAULT,
  portfolio: DOCK_WIDTH_DEFAULT,
};

const DEFAULT_WIDTH_RATIOS: Record<DockableWidgetId, number> = {
  "wallet-tracker": DOCK_WIDTH_DEFAULT_RATIO,
  activity: DOCK_WIDTH_DEFAULT_RATIO,
  watchlist: DOCK_WIDTH_DEFAULT_RATIO,
  portfolio: DOCK_WIDTH_DEFAULT_RATIO,
};

interface DockLayoutState {
  dockWidget: (id: DockableWidgetId, side: DockSide) => void;
  leftSlot: DockableWidgetId | null;
  rightSlot: DockableWidgetId | null;
  setWidth: (side: DockSide, width: number) => void;
  syncToViewport: () => void;
  undockWidget: (id: DockableWidgetId) => void;
  widthRatios: Record<DockableWidgetId, number>;
  widths: Record<DockableWidgetId, number>;
}

export const useDockLayoutStore = create<DockLayoutState>()(
  persist(
    (set) => ({
      leftSlot: null,
      rightSlot: null,
      widths: { ...DEFAULT_WIDTHS },
      widthRatios: { ...DEFAULT_WIDTH_RATIOS },

      dockWidget: (id, side) =>
        set((s) => {
          const otherSide = side === "left" ? "right" : "left";
          const otherSlotKey = `${otherSide}Slot` as "leftSlot" | "rightSlot";
          return {
            [`${side}Slot`]: id,
            // If this widget was already in the other slot, clear it from there
            [otherSlotKey]: s[otherSlotKey] === id ? null : s[otherSlotKey],
          };
        }),

      undockWidget: (id) =>
        set((s) => ({
          leftSlot: s.leftSlot === id ? null : s.leftSlot,
          rightSlot: s.rightSlot === id ? null : s.rightSlot,
        })),

      setWidth: (side, width) =>
        set((s) => {
          const slotId = side === "left" ? s.leftSlot : s.rightSlot;
          if (!slotId) {
            return s;
          }
          const otherSlotId = side === "left" ? s.rightSlot : s.leftSlot;
          const otherWidth = otherSlotId ? s.widths[otherSlotId] : 0;
          const viewportWidth =
            typeof window === "undefined"
              ? Number.POSITIVE_INFINITY
              : window.innerWidth;
          const clamped = clampDockWidthForLayout(
            width,
            viewportWidth,
            otherWidth
          );
          const ratio =
            Number.isFinite(viewportWidth) && viewportWidth > 0
              ? clamped / viewportWidth
              : s.widthRatios[slotId];
          return {
            widths: { ...s.widths, [slotId]: clamped },
            widthRatios: { ...s.widthRatios, [slotId]: ratio },
          };
        }),
      syncToViewport: () =>
        set((s) => {
          const viewportWidth = getDockViewportWidth();
          if (!Number.isFinite(viewportWidth) || viewportWidth <= 0) {
            return s;
          }
          const normalized = normalizeWidthsForSlots(
            viewportWidth,
            s.leftSlot,
            s.rightSlot,
            s.widthRatios
          );
          if (
            (s.leftSlot == null ||
              normalized[s.leftSlot] === s.widths[s.leftSlot]) &&
            (s.rightSlot == null ||
              normalized[s.rightSlot] === s.widths[s.rightSlot])
          ) {
            return s;
          }
          return { widths: { ...s.widths, ...normalized } };
        }),
    }),
    {
      name: DOCK_LAYOUT_STORAGE_KEY,
      version: 3,
      migrate: (persisted, version) => {
        const state = persisted as DockLayoutState & {
          widths?: Partial<Record<DockableWidgetId, number>>;
          widthRatios?: Partial<Record<DockableWidgetId, number>>;
        };
        if (version < 3) {
          const widthRatios = { ...DEFAULT_WIDTH_RATIOS };
          const normalizedWidths = normalizePersistedWidths(
            state.widths ?? {},
            state.leftSlot ?? null,
            state.rightSlot ?? null
          );
          return {
            ...state,
            widths: normalizedWidths,
            widthRatios,
          };
        }
        const normalizedWidths = normalizePersistedWidths(
          state.widths ?? {},
          state.leftSlot ?? null,
          state.rightSlot ?? null
        );
        const widthRatios = normalizeRatios(state.widthRatios ?? {});
        return { ...state, widths: normalizedWidths, widthRatios };
      },
      /**
       * Skip automatic rehydration on store creation. Without this, Zustand reads
       * localStorage synchronously before React hydrates, causing the client's first
       * render to differ from the server HTML (dock panels present vs absent).
       * React detects the mismatch and re-renders the entire DockShell subtree
       * client-side — the visible "dock pop" on hard refresh.
       *
       * Instead, DockShell calls `useDockLayoutStore.persist.rehydrate()` in a
       * useEffect, which fires after successful hydration. The dock panels then
       * appear in the next frame, which is less jarring and avoids the hydration error.
       */
      skipHydration: true,
      onRehydrateStorage: () => (_state, error) => {
        if (error) {
          logger.warn("[dock-layout] Failed to rehydrate dock state:", error);
        }
        invalidateStorageCache(DOCK_LAYOUT_STORAGE_KEY);
      },
    }
  )
);
