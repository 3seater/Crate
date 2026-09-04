"use client";

import { PanelLeftClose, PanelRightClose, X } from "lucide-react";
import { getDockChromePaddingClass } from "@/shell/dock-chrome-padding";
import {
  DOCK_WIDTH_DEFAULT,
  type DockableWidgetId,
  type DockSide,
  useDockLayoutStore,
} from "@/shell/stores/dock-layout";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/ui/tooltip";
import { DockResizeHandle } from "./dock-resize-handle";

const WIDGET_LABELS: Record<DockableWidgetId, string> = {
  "wallet-tracker": "Wallet Tracker",
  activity: "Activity",
  watchlist: "Watchlist",
  portfolio: "Portfolio",
};

interface DockSlotProps {
  side: DockSide;
}

export function DockSlot({ side }: DockSlotProps) {
  const slotKey = side === "left" ? "leftSlot" : "rightSlot";
  const widgetId = useDockLayoutStore((s) => s[slotKey]);
  // Only subscribe to this slot's width — avoids re-render when the other slot resizes
  const currentWidth = useDockLayoutStore((s) => {
    const id = s[slotKey];
    return id ? s.widths[id] : DOCK_WIDTH_DEFAULT;
  });
  const undockWidget = useDockLayoutStore((s) => s.undockWidget);

  const handleUndockKeepOpen = () => {
    if (!widgetId) {
      return;
    }
    window.dispatchEvent(
      new CustomEvent("doji:open-widget", { detail: { widgetId } })
    );
    undockWidget(widgetId);
  };

  const handleCloseDockedWidget = () => {
    if (!widgetId) {
      return;
    }
    undockWidget(widgetId);
  };

  const cssVar = `var(--dock-${side}-width)`;

  // Render nothing (zero width) when no widget is docked
  if (!widgetId) {
    return (
      <div
        data-dock-panel
        style={{ width: 0, flexShrink: 0, overflow: "hidden" }}
      />
    );
  }

  return (
    <div
      className="relative flex h-full shrink-0 items-stretch"
      data-dock-panel
      style={{ width: cssVar, flexShrink: 0 }}
    >
      {/* Resize handle on the outer edge (between dock and main content) */}
      {side === "right" && (
        <DockResizeHandle currentWidth={currentWidth} side={side} />
      )}

      {/* Widget card */}
      <div className="my-1.5 flex min-w-0 flex-1 flex-col overflow-hidden rounded-xl border border-border-frame bg-card">
        {/* Widget header bar */}
        <div
          className={[
            "flex h-10 shrink-0 items-center justify-between bg-surface-2",
            getDockChromePaddingClass(true, side),
          ].join(" ")}
        >
          <div className="flex items-center gap-2">
            <span className="font-medium text-sm text-text-primary">
              {WIDGET_LABELS[widgetId]}
            </span>
          </div>
          <TooltipProvider>
            <div className="flex items-center gap-1">
              <Tooltip>
                <TooltipTrigger render={<span className="inline-flex" />}>
                  <button
                    aria-label="Undock widget"
                    className="flex h-7 w-7 cursor-pointer items-center justify-center rounded-md text-text-tertiary transition-colors hover:text-foreground"
                    onClick={handleUndockKeepOpen}
                    type="button"
                  >
                    {side === "left" ? (
                      <PanelLeftClose className="h-4 w-4" />
                    ) : (
                      <PanelRightClose className="h-4 w-4" />
                    )}
                  </button>
                </TooltipTrigger>
                <TooltipContent>Undock</TooltipContent>
              </Tooltip>
              <Tooltip>
                <TooltipTrigger render={<span className="inline-flex" />}>
                  <button
                    aria-label="Close panel"
                    className="flex h-7 w-7 cursor-pointer items-center justify-center rounded-md text-text-tertiary transition-colors hover:text-foreground"
                    onClick={handleCloseDockedWidget}
                    type="button"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </TooltipTrigger>
                <TooltipContent>Close panel</TooltipContent>
              </Tooltip>
            </div>
          </TooltipProvider>
        </div>

        {/* Widget content placeholder */}
        <div className="min-h-0 flex-1 overflow-x-auto overflow-y-hidden">
          <div className="flex h-full min-h-0 min-w-0 flex-col" />
        </div>
      </div>

      {/* Resize handle on the outer edge (between dock and main content) */}
      {side === "left" && (
        <DockResizeHandle currentWidth={currentWidth} side={side} />
      )}
    </div>
  );
}
