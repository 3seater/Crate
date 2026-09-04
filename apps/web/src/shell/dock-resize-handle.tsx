"use client";

import { startTransition, useRef, useState } from "react";
import {
  clampDockWidth,
  DOCK_WIDTH_MIN,
  type DockSide,
  useDockLayoutStore,
} from "@/shell/stores/dock-layout";

interface DockResizeHandleProps {
  currentWidth: number;
  side: DockSide;
}

export function DockResizeHandle({
  side,
  currentWidth,
}: DockResizeHandleProps) {
  const setWidth = useDockLayoutStore((s) => s.setWidth);
  const [isDragging, setIsDragging] = useState(false);
  const startX = useRef(0);
  const startWidth = useRef(currentWidth);
  // Direct DOM ref to the panel — mutate width during drag without React re-renders
  const panelRef = useRef<HTMLElement | null>(null);
  const currentMaxWidth = clampDockWidth(Number.MAX_SAFE_INTEGER);

  const handlePointerDown = (e: React.PointerEvent<HTMLButtonElement>) => {
    e.preventDefault();
    e.currentTarget.setPointerCapture(e.pointerId);
    startX.current = e.clientX;
    startWidth.current = currentWidth;
    setIsDragging(true);
    panelRef.current =
      e.currentTarget.closest<HTMLElement>("[data-dock-panel]");
    // Lock cursor globally so it doesn't flicker when pointer leaves the handle
    document.body.style.cursor = "ew-resize";
    document.body.style.userSelect = "none";
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLButtonElement>) => {
    if (!e.currentTarget.hasPointerCapture(e.pointerId)) {
      return;
    }
    const delta =
      side === "left" ? e.clientX - startX.current : startX.current - e.clientX;
    const next = clampDockWidth(startWidth.current + delta);
    // Mutate DOM directly — zero React overhead during drag
    if (panelRef.current) {
      panelRef.current.style.width = `${next}px`;
    }
    document.documentElement.style.setProperty(
      `--dock-${side}-width`,
      `${next}px`
    );
  };

  const handlePointerUp = (e: React.PointerEvent<HTMLButtonElement>) => {
    e.currentTarget.releasePointerCapture(e.pointerId);
    setIsDragging(false);
    document.body.style.cursor = "";
    document.body.style.userSelect = "";
    const delta =
      side === "left" ? e.clientX - startX.current : startX.current - e.clientX;
    const finalWidth = clampDockWidth(startWidth.current + delta);
    startTransition(() => {
      setWidth(side, finalWidth);
    });
  };

  return (
    <div
      className="relative z-10 flex shrink-0 items-center"
      style={{
        width: 8,
      }}
    >
      {/* Full-viewport overlay during drag prevents pointer capture loss */}
      {isDragging && (
        <div className="fixed inset-0 z-50" style={{ cursor: "ew-resize" }} />
      )}
      <button
        aria-label={`Resize ${side} panel`}
        aria-valuemax={currentMaxWidth}
        aria-valuemin={DOCK_WIDTH_MIN}
        aria-valuenow={currentWidth}
        className={[
          "group flex h-full w-full cursor-ew-resize select-none items-center justify-center",
          "border-0 p-0 outline-none",
          "bg-transparent",
          "",
        ].join(" ")}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        role="slider"
        tabIndex={0}
        type="button"
      >
        {/* Restore classic centered drag pill while keeping the lane transparent */}
        <div
          className={[
            "h-8 w-0.5 rounded-full transition-colors",
            isDragging
              ? "bg-text-muted"
              : "bg-border/40 group-hover:bg-text-muted",
          ].join(" ")}
        />
      </button>
    </div>
  );
}
