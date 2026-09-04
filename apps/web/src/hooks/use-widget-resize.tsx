// ── Types ────────────────────────────────────────────────────────────────────

import {
  type MouseEvent as ReactMouseEvent,
  type ReactNode,
  type RefObject,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";

// Global z-index counter so the most recently focused widget is always on top.
let widgetZCounter = 50;
export function nextWidgetZ(): number {
  widgetZCounter += 1;
  return widgetZCounter;
}

export type ResizeDirection =
  | "top"
  | "right"
  | "bottom"
  | "left"
  | "top-left"
  | "top-right"
  | "bottom-left"
  | "bottom-right";

export interface WidgetSize {
  height: number;
  width: number;
}

export interface WidgetPosition {
  x: number;
  y: number;
}

export interface UseWidgetResizeConfig {
  /** Bottom bar height to subtract from viewport (default 48) */
  bottomBarHeight?: number;
  /** Default height when widget opens */
  defaultHeight: number;
  /**
   * Optional viewport-height ceiling (0–1). Open height uses
   * `min(defaultHeight, floor(usableViewport * ratio), usableViewport)`.
   */
  defaultHeightRatio?: number;
  /** Default width when widget opens */
  defaultWidth: number;
  /**
   * Optional viewport-width ceiling (0–1). Open width uses
   * `min(defaultWidth, floor(viewport * ratio), viewport)`.
   */
  defaultWidthRatio?: number;
  /** Maximum height in px (optional — defaults to viewport height) */
  maxHeight?: number;
  /** Maximum height as ratio of viewport height (optional) */
  maxHeightRatio?: number;
  /** Maximum width in px (optional — defaults to viewport width) */
  maxWidth?: number;
  /** Maximum width as ratio of viewport width (optional) */
  maxWidthRatio?: number;
  /** Minimum height in px (300 for all widgets) */
  minHeight: number;
  /** Per-widget minimum width in px */
  minWidth: number;
}

export interface ClampConfig {
  bottomBarHeight: number;
  maxHeight?: number;
  maxHeightRatio?: number;
  maxWidth?: number;
  maxWidthRatio?: number;
  minHeight: number;
  minWidth: number;
}

export interface Viewport {
  height: number;
  width: number;
}

interface Proposed {
  height: number;
  width: number;
  x: number;
  y: number;
}

// ── Pure functions ───────────────────────────────────────────────────────────

/**
 * Clamp a proposed size + position so that:
 *  - width  >= config.minWidth
 *  - height >= config.minHeight
 *  - x + width  <= viewport.width
 *  - y + height <= viewport.height - config.bottomBarHeight
 *  - x >= 0
 *  - y >= 0
 */
export function clampSize(
  proposed: Proposed,
  config: ClampConfig,
  viewport: Viewport
): { width: number; height: number; x: number; y: number } {
  const maxH = viewport.height - config.bottomBarHeight;

  // Clamp position first — must be non-negative
  const x = Math.max(0, proposed.x);
  const y = Math.max(0, proposed.y);

  // Clamp width: at least minWidth, at most maxWidth/maxWidthRatio or viewport edge
  const maxWidthFromRatio =
    config.maxWidthRatio == null
      ? null
      : Math.floor(viewport.width * config.maxWidthRatio);
  const upperW = [
    viewport.width - x,
    config.maxWidth ?? Number.POSITIVE_INFINITY,
    maxWidthFromRatio ?? Number.POSITIVE_INFINITY,
  ].reduce((acc, val) => Math.min(acc, val), Number.POSITIVE_INFINITY);
  const minW = Math.min(config.minWidth, Math.max(0, viewport.width - x));
  const width = Math.max(minW, Math.min(proposed.width, upperW));

  // Clamp height: at least minHeight, at most maxHeight/maxHeightRatio or viewport edge
  const availableH = maxH - y;
  const maxHeightFromRatio =
    config.maxHeightRatio == null
      ? null
      : Math.floor(maxH * config.maxHeightRatio);
  const upperH = [
    availableH,
    config.maxHeight ?? Number.POSITIVE_INFINITY,
    maxHeightFromRatio ?? Number.POSITIVE_INFINITY,
  ].reduce((acc, val) => Math.min(acc, val), Number.POSITIVE_INFINITY);
  const minH = Math.min(config.minHeight, Math.max(0, availableH));
  const height = Math.max(minH, Math.min(proposed.height, upperH));

  return { width, height, x, y };
}

/**
 * Compute new size and position after a resize drag in the given direction.
 *
 * - Right/bottom edge: only width/height changes, position stays.
 * - Top/left edge: width/height changes AND position adjusts to anchor the opposite edge.
 * - Corners: combine the appropriate edge behaviours.
 */
export function computeResize(
  direction: ResizeDirection,
  startSize: WidgetSize,
  startPosition: WidgetPosition,
  delta: { dx: number; dy: number },
  config: ClampConfig,
  viewport: Viewport
): { width: number; height: number; x: number; y: number } {
  let newWidth = startSize.width;
  let newHeight = startSize.height;
  let newX = startPosition.x;
  let newY = startPosition.y;

  // Horizontal component
  const hasRight =
    direction === "right" ||
    direction === "top-right" ||
    direction === "bottom-right";
  const hasLeft =
    direction === "left" ||
    direction === "top-left" ||
    direction === "bottom-left";

  if (hasRight) {
    newWidth = startSize.width + delta.dx;
  } else if (hasLeft) {
    newWidth = startSize.width - delta.dx;
    newX = startPosition.x + delta.dx;
  }

  // Vertical component
  const hasBottom =
    direction === "bottom" ||
    direction === "bottom-left" ||
    direction === "bottom-right";
  const hasTop =
    direction === "top" ||
    direction === "top-left" ||
    direction === "top-right";

  if (hasBottom) {
    newHeight = startSize.height + delta.dy;
  } else if (hasTop) {
    newHeight = startSize.height - delta.dy;
    newY = startPosition.y + delta.dy;
  }

  return clampSize(
    { width: newWidth, height: newHeight, x: newX, y: newY },
    config,
    viewport
  );
}

// ── Internal types ───────────────────────────────────────────────────────────

interface ResizeState {
  direction: ResizeDirection;
  startPointer: { x: number; y: number };
  startPosition: WidgetPosition;
  startSize: WidgetSize;
}

interface DragState {
  startPointer: { x: number; y: number };
  startPosition: WidgetPosition;
}

export interface UseWidgetResizeReturn {
  bringToFront: () => void;
  dragHandleProps: {
    onMouseDown: (e: ReactMouseEvent<HTMLButtonElement>) => void;
    onPointerDown: (e: React.PointerEvent) => void;
  };
  isDragging: boolean;
  isResizing: boolean;
  panelRef: RefObject<HTMLDivElement | null>;
  position: WidgetPosition;
  renderResizeHandles: () => ReactNode;
  resetPosition: () => void;
  size: WidgetSize;
  zIndex: number;
}

// ── Hook ─────────────────────────────────────────────────────────────────────

export function useWidgetResize(
  config: UseWidgetResizeConfig,
  onClose: () => void
): UseWidgetResizeReturn {
  const { minWidth, minHeight, defaultWidth, defaultHeight } = config;
  const bottomBarHeight = config.bottomBarHeight ?? 48;
  const clampCfg: ClampConfig = {
    minWidth,
    minHeight,
    bottomBarHeight,
    maxWidth: config.maxWidth,
    maxHeight: config.maxHeight,
    maxWidthRatio: config.maxWidthRatio,
    maxHeightRatio: config.maxHeightRatio,
  };

  // ── Committed state ────────────────────────────────────────────────────
  const [size, setSize] = useState<WidgetSize>({
    width: defaultWidth,
    height: defaultHeight,
  });
  const [position, setPosition] = useState<WidgetPosition>({ x: 0, y: 0 });
  const [isResizing, setIsResizing] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [zIndex, setZIndex] = useState(() => nextWidgetZ());

  const bringToFront = useCallback(() => {
    setZIndex(nextWidgetZ());
  }, []);

  // ── Refs (no re-renders during pointer tracking) ───────────────────────
  const panelRef = useRef<HTMLDivElement | null>(null);
  const resizeRef = useRef<ResizeState | null>(null);
  const dragRef = useRef<DragState | null>(null);
  const rafRef = useRef<number | null>(null);
  const latestPointer = useRef({ x: 0, y: 0 });
  const sizeRef = useRef(size);
  const positionRef = useRef(position);
  const onCloseRef = useRef(onClose);
  const clampCfgRef = useRef(clampCfg);

  useEffect(() => {
    sizeRef.current = size;
  }, [size]);
  useEffect(() => {
    positionRef.current = position;
  }, [position]);
  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);
  useEffect(() => {
    clampCfgRef.current = clampCfg;
  });

  // ── Helpers ────────────────────────────────────────────────────────────
  const cancelRaf = useCallback(() => {
    if (rafRef.current !== null) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
  }, []);

  // ── Resize: start ──────────────────────────────────────────────────────
  const startResize = useCallback(
    (direction: ResizeDirection, e: globalThis.MouseEvent) => {
      if (resizeRef.current || dragRef.current) {
        return;
      }
      e.preventDefault();
      resizeRef.current = {
        direction,
        startPointer: { x: e.clientX, y: e.clientY },
        startSize: { ...sizeRef.current },
        startPosition: { ...positionRef.current },
      };
      setIsResizing(true);
    },
    []
  );

  // ── Resize: track + commit ─────────────────────────────────────────────
  useEffect(() => {
    if (!isResizing) {
      return;
    }

    const viewport: Viewport = {
      width: window.innerWidth,
      height: window.innerHeight,
    };

    const flushResize = () => {
      rafRef.current = null;
      const rs = resizeRef.current;
      if (!rs) {
        return;
      }
      const dx = latestPointer.current.x - rs.startPointer.x;
      const dy = latestPointer.current.y - rs.startPointer.y;
      const result = computeResize(
        rs.direction,
        rs.startSize,
        rs.startPosition,
        { dx, dy },
        clampCfgRef.current,
        viewport
      );
      const el = panelRef.current;
      if (el) {
        el.style.width = `${String(result.width)}px`;
        el.style.height = `${String(result.height)}px`;
        el.style.left = `${String(result.x)}px`;
        el.style.top = `${String(result.y)}px`;
      }
      setSize({ width: result.width, height: result.height });
      setPosition({ x: result.x, y: result.y });
    };

    const onMove = (e: globalThis.MouseEvent) => {
      latestPointer.current = { x: e.clientX, y: e.clientY };
      if (rafRef.current === null) {
        rafRef.current = requestAnimationFrame(flushResize);
      }
    };

    const onUp = () => {
      cancelRaf();
      const rs = resizeRef.current;
      if (rs) {
        const dx = latestPointer.current.x - rs.startPointer.x;
        const dy = latestPointer.current.y - rs.startPointer.y;
        const result = computeResize(
          rs.direction,
          rs.startSize,
          rs.startPosition,
          { dx, dy },
          clampCfgRef.current,
          viewport
        );
        setSize({ width: result.width, height: result.height });
        setPosition({ x: result.x, y: result.y });
      }
      resizeRef.current = null;
      setIsResizing(false);
    };

    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    return () => {
      cancelRaf();
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
  }, [isResizing, cancelRaf]);

  // ── Escape during resize ───────────────────────────────────────────────
  useEffect(() => {
    if (!isResizing) {
      return;
    }
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        cancelRaf();
        const rs = resizeRef.current;
        if (rs) {
          setSize({ ...rs.startSize });
          setPosition({ ...rs.startPosition });
          const el = panelRef.current;
          if (el) {
            el.style.width = `${String(rs.startSize.width)}px`;
            el.style.height = `${String(rs.startSize.height)}px`;
            el.style.left = `${String(rs.startPosition.x)}px`;
            el.style.top = `${String(rs.startPosition.y)}px`;
          }
        }
        resizeRef.current = null;
        setIsResizing(false);
        onCloseRef.current();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [isResizing, cancelRaf]);

  // ── Drag: start ────────────────────────────────────────────────────────
  const handleDragMouseDown = useCallback(
    (e: ReactMouseEvent<HTMLButtonElement>) => {
      if ((e.target as HTMLElement).closest("button") !== e.currentTarget) {
        return;
      }
      if (resizeRef.current || dragRef.current) {
        return;
      }
      setIsDragging(true);
      bringToFront();
      dragRef.current = {
        startPointer: { x: e.clientX, y: e.clientY },
        startPosition: { ...positionRef.current },
      };
    },
    [bringToFront]
  );

  // ── Drag: track + commit ───────────────────────────────────────────────
  useEffect(() => {
    if (!isDragging) {
      return;
    }

    const flushDrag = () => {
      rafRef.current = null;
      const ds = dragRef.current;
      if (!ds) {
        return;
      }
      const dx = latestPointer.current.x - ds.startPointer.x;
      const dy = latestPointer.current.y - ds.startPointer.y;
      const newX = Math.max(0, ds.startPosition.x + dx);
      const newY = Math.max(0, ds.startPosition.y + dy);
      const el = panelRef.current;
      if (el) {
        el.style.left = `${String(newX)}px`;
        el.style.top = `${String(newY)}px`;
      }
      setPosition({ x: newX, y: newY });
    };

    const onMove = (e: globalThis.MouseEvent) => {
      latestPointer.current = { x: e.clientX, y: e.clientY };
      if (rafRef.current === null) {
        rafRef.current = requestAnimationFrame(flushDrag);
      }
    };

    const onUp = () => {
      cancelRaf();
      const ds = dragRef.current;
      if (ds) {
        const dx = latestPointer.current.x - ds.startPointer.x;
        const dy = latestPointer.current.y - ds.startPointer.y;
        setPosition({
          x: Math.max(0, ds.startPosition.x + dx),
          y: Math.max(0, ds.startPosition.y + dy),
        });
      }
      dragRef.current = null;
      setIsDragging(false);
    };

    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    return () => {
      cancelRaf();
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
  }, [isDragging, cancelRaf]);

  // ── Reset position (center on open, offset if another widget is there) ──
  const resetPosition = useCallback(() => {
    const vw = window.innerWidth;
    const vh = window.innerHeight - bottomBarHeight;
    // Clamp default size to viewport + optional ratios so widgets keep consistent proportions.
    const defaultWFromRatio =
      config.defaultWidthRatio == null
        ? null
        : Math.floor(vw * config.defaultWidthRatio);
    const defaultHFromRatio =
      config.defaultHeightRatio == null
        ? null
        : Math.floor(vh * config.defaultHeightRatio);
    // Prefer the smaller of px default and ratio cap so optional ratios act as a
    // viewport ceiling (restores pre-ratio behavior: defaultWidthPx wins on wide screens).
    const candidateW = Math.min(
      defaultWidth,
      defaultWFromRatio ?? Number.POSITIVE_INFINITY,
      vw
    );
    const candidateH = Math.min(
      defaultHeight,
      defaultHFromRatio ?? Number.POSITIVE_INFINITY,
      vh
    );
    const w = Math.max(Math.min(minWidth, vw), candidateW);
    const h = Math.max(Math.min(minHeight, vh), candidateH);

    const baseX = Math.max(0, (vw - w) / 2);
    const baseY = Math.max(0, (vh - h) / 2);

    // Check if other widgets overlap the default center position
    const OFFSET_STEP = 30;
    const existing = document.querySelectorAll("[data-bottom-bar-widget]");
    let offsetCount = 0;
    for (const el of existing) {
      if (el === panelRef.current) {
        continue;
      }
      const rect = el.getBoundingClientRect();
      const targetX = baseX + offsetCount * OFFSET_STEP;
      const targetY = baseY + offsetCount * OFFSET_STEP;
      // If an existing widget is within 20px of where we'd place this one, bump offset
      if (
        Math.abs(rect.left - targetX) < 20 &&
        Math.abs(rect.top - targetY) < 20
      ) {
        offsetCount++;
      }
    }

    const x = Math.max(0, baseX + offsetCount * OFFSET_STEP);
    const y = Math.max(0, baseY + offsetCount * OFFSET_STEP);
    setPosition({ x, y });
    setSize({ width: w, height: h });
    bringToFront();
  }, [
    defaultWidth,
    defaultHeight,
    config.defaultWidthRatio,
    config.defaultHeightRatio,
    minWidth,
    minHeight,
    bottomBarHeight,
    bringToFront,
  ]);

  // ── Render resize handles ──────────────────────────────────────────────
  const renderResizeHandles = useCallback((): ReactNode => {
    const onHandleDown =
      (direction: ResizeDirection) => (e: React.MouseEvent<HTMLDivElement>) => {
        startResize(direction, e.nativeEvent);
      };

    const base: React.CSSProperties = {
      position: "absolute",
      zIndex: 10,
    };

    return (
      <>
        {/* Edge handles — 6px thick, full edge length */}
        <div
          className="widget-resize-handle"
          key="resize-top"
          onMouseDown={onHandleDown("top")}
          role="none"
          style={{
            ...base,
            top: 0,
            left: 6,
            right: 6,
            height: 6,
            cursor: "ns-resize",
            borderRadius: "3px 3px 0 0",
          }}
        />
        <div
          className="widget-resize-handle"
          key="resize-bottom"
          onMouseDown={onHandleDown("bottom")}
          role="none"
          style={{
            ...base,
            bottom: 0,
            left: 6,
            right: 6,
            height: 6,
            cursor: "ns-resize",
            borderRadius: "0 0 3px 3px",
          }}
        />
        <div
          className="widget-resize-handle"
          key="resize-left"
          onMouseDown={onHandleDown("left")}
          role="none"
          style={{
            ...base,
            top: 6,
            bottom: 6,
            left: 0,
            width: 6,
            cursor: "ew-resize",
          }}
        />
        <div
          className="widget-resize-handle"
          key="resize-right"
          onMouseDown={onHandleDown("right")}
          role="none"
          style={{
            ...base,
            top: 6,
            bottom: 6,
            right: 0,
            width: 6,
            cursor: "ew-resize",
          }}
        />

        {/* Corner handles — visible grip dots */}
        <div
          className="widget-resize-corner"
          key="resize-top-left"
          onMouseDown={onHandleDown("top-left")}
          role="none"
          style={{
            ...base,
            top: 0,
            left: 0,
            width: 12,
            height: 12,
            cursor: "nwse-resize",
            borderRadius: "4px 0 0 0",
          }}
        />
        <div
          className="widget-resize-corner"
          key="resize-top-right"
          onMouseDown={onHandleDown("top-right")}
          role="none"
          style={{
            ...base,
            top: 0,
            right: 0,
            width: 12,
            height: 12,
            cursor: "nesw-resize",
            borderRadius: "0 4px 0 0",
          }}
        />
        <div
          className="widget-resize-corner"
          key="resize-bottom-left"
          onMouseDown={onHandleDown("bottom-left")}
          role="none"
          style={{
            ...base,
            bottom: 0,
            left: 0,
            width: 12,
            height: 12,
            cursor: "nesw-resize",
            borderRadius: "0 0 0 4px",
          }}
        />
        {/* Bottom-right: show a visible grip icon */}
        <div
          className="widget-resize-corner"
          key="resize-bottom-right"
          onMouseDown={onHandleDown("bottom-right")}
          role="none"
          style={{
            ...base,
            bottom: 0,
            right: 0,
            width: 16,
            height: 16,
            cursor: "nwse-resize",
            borderRadius: "0 0 4px 0",
            display: "flex",
            alignItems: "flex-end",
            justifyContent: "flex-end",
            padding: "3px",
          }}
        >
          {/* Three diagonal dots — standard resize grip */}
          <svg
            aria-hidden="true"
            fill="currentColor"
            height="10"
            style={{ color: "rgba(255,255,255,0.25)", pointerEvents: "none" }}
            viewBox="0 0 10 10"
            width="10"
          >
            <circle cx="8" cy="8" r="1.2" />
            <circle cx="5" cy="8" r="1.2" />
            <circle cx="8" cy="5" r="1.2" />
          </svg>
        </div>

        {/* Interaction guard overlay — blocks child pointer events during resize */}
        {isResizing && (
          <div
            key="resize-overlay"
            style={{ position: "absolute", inset: 0, zIndex: 9 }}
          />
        )}
      </>
    );
  }, [startResize, isResizing]);

  return {
    size,
    position,
    isResizing,
    isDragging,
    panelRef,
    dragHandleProps: {
      onMouseDown: handleDragMouseDown,
      onPointerDown: (e: React.PointerEvent) => e.stopPropagation(),
    },
    renderResizeHandles,
    resetPosition,
    zIndex,
    bringToFront,
  };
}
