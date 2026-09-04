export type FloatingWidgetId =
  | "wallet-tracker"
  | "activity"
  | "watchlist"
  | "portfolio";

export interface ResponsiveWidgetSizing {
  defaultHeightPx: number;
  defaultHeightRatio?: number;
  defaultWidthPx: number;
  defaultWidthRatio?: number;
  maxHeightPx?: number;
  maxHeightRatio?: number;
  maxWidthPx?: number;
  maxWidthRatio?: number;
  minHeightPx: number;
  minWidthPx: number;
}

export const FLOATING_WIDGET_SIZING: Record<
  FloatingWidgetId,
  ResponsiveWidgetSizing
> = {
  activity: {
    minWidthPx: 580,
    minHeightPx: 300,
    defaultWidthPx: 760,
    defaultHeightPx: 680,
    defaultWidthRatio: 0.62,
    maxWidthPx: 1200,
    maxWidthRatio: 0.78,
  },
  portfolio: {
    minWidthPx: 420,
    minHeightPx: 280,
    defaultWidthPx: 560,
    defaultHeightPx: 480,
    defaultWidthRatio: 0.48,
    maxWidthPx: 880,
    maxWidthRatio: 0.62,
  },
  watchlist: {
    minWidthPx: 600,
    minHeightPx: 300,
    defaultWidthPx: 1100,
    defaultHeightPx: 650,
    defaultWidthRatio: 0.78,
    maxWidthPx: 1500,
    maxWidthRatio: 0.88,
  },
  "wallet-tracker": {
    minWidthPx: 600,
    minHeightPx: 300,
    defaultWidthPx: 1100,
    defaultHeightPx: 650,
    defaultWidthRatio: 0.78,
    maxWidthPx: 1500,
    maxWidthRatio: 0.88,
  },
};

export const DOCK_WIDTH_DEFAULT = 380;
export const DOCK_WIDTH_MIN = 280;
export const DOCK_WIDTH_MAX = 720;
export const DOCK_WIDTH_MAX_RATIO = 0.3;
export const DOCK_MAIN_MIN_WIDTH = 920;
export const DOCK_MAIN_MIN_RATIO = 0.68;
export const DOCK_WIDTH_DEFAULT_RATIO = 0.22;

export function clampDockWidthForViewport(
  width: number,
  viewportWidth: number
): number {
  const boundedViewport = Number.isFinite(viewportWidth)
    ? Math.max(0, viewportWidth)
    : 0;
  const ratioMax =
    boundedViewport > 0
      ? Math.floor(boundedViewport * DOCK_WIDTH_MAX_RATIO)
      : DOCK_WIDTH_MAX;
  const maxAllowed = Math.max(
    DOCK_WIDTH_MIN,
    Math.min(DOCK_WIDTH_MAX, ratioMax)
  );
  return Math.min(maxAllowed, Math.max(DOCK_WIDTH_MIN, width));
}

export function clampDockWidthForLayout(
  width: number,
  viewportWidth: number,
  otherSideWidth: number
): number {
  const baseClamped = clampDockWidthForViewport(width, viewportWidth);
  if (!Number.isFinite(viewportWidth) || viewportWidth <= 0) {
    return baseClamped;
  }
  const boundedOther = Math.max(0, otherSideWidth);
  const minCenterWidth = Math.max(
    DOCK_MAIN_MIN_WIDTH,
    Math.floor(viewportWidth * DOCK_MAIN_MIN_RATIO)
  );
  const maxByCenter = viewportWidth - boundedOther - minCenterWidth;
  const maxAllowed = Math.max(
    DOCK_WIDTH_MIN,
    Math.min(DOCK_WIDTH_MAX, Math.floor(maxByCenter))
  );
  return Math.min(maxAllowed, Math.max(DOCK_WIDTH_MIN, baseClamped));
}
