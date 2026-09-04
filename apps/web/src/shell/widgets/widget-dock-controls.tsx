"use client";

import { PanelLeft, PanelRight, X } from "lucide-react";
import type { DockableWidgetId } from "@/shell/stores/dock-layout";
import { useDockLayoutStore } from "@/shell/stores/dock-layout";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/ui/tooltip";

interface WidgetDockControlsProps {
  widgetId: DockableWidgetId;
}

export function WidgetDockControls({ widgetId }: WidgetDockControlsProps) {
  const leftSlot = useDockLayoutStore((s) => s.leftSlot);
  const rightSlot = useDockLayoutStore((s) => s.rightSlot);
  const dockWidget = useDockLayoutStore((s) => s.dockWidget);
  const undockWidget = useDockLayoutStore((s) => s.undockWidget);

  const isDockedLeft = leftSlot === widgetId;
  const isDockedRight = rightSlot === widgetId;
  const isDocked = isDockedLeft || isDockedRight;
  const dockActionButtonClass =
    "flex h-7 w-7 cursor-pointer items-center justify-center rounded-md text-text-tertiary transition-colors hover:text-foreground";

  return (
    <TooltipProvider>
      <div className="flex items-center gap-0.5">
        {!isDockedLeft && (
          <Tooltip>
            <TooltipTrigger render={<span className="inline-flex" />}>
              <button
                aria-label="Dock left"
                className={dockActionButtonClass}
                onClick={() => dockWidget(widgetId, "left")}
                type="button"
              >
                <PanelLeft className="h-3.5 w-3.5" />
              </button>
            </TooltipTrigger>
            <TooltipContent>Dock left</TooltipContent>
          </Tooltip>
        )}

        {!isDockedRight && (
          <Tooltip>
            <TooltipTrigger render={<span className="inline-flex" />}>
              <button
                aria-label="Dock right"
                className={dockActionButtonClass}
                onClick={() => dockWidget(widgetId, "right")}
                type="button"
              >
                <PanelRight className="h-3.5 w-3.5" />
              </button>
            </TooltipTrigger>
            <TooltipContent>Dock right</TooltipContent>
          </Tooltip>
        )}

        {isDocked && (
          <Tooltip>
            <TooltipTrigger render={<span className="inline-flex" />}>
              <button
                aria-label="Undock widget"
                className={dockActionButtonClass}
                onClick={() => undockWidget(widgetId)}
                type="button"
              >
                <X className="h-4 w-4" />
              </button>
            </TooltipTrigger>
            <TooltipContent>Undock</TooltipContent>
          </Tooltip>
        )}
      </div>
    </TooltipProvider>
  );
}
