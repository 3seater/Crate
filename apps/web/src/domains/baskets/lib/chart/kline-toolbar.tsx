"use client";

/**
 * KLineChart Pro-style toolbar — exact SVG icons from github.com/klinecharts/pro (Apache 2.0).
 * Left sidebar: drawing/overlay tools with flyout sub-menus.
 * Top bar extras: Indicator picker, Screenshot, Fullscreen.
 */

import type { Chart } from "klinecharts";
import { Camera, Maximize2 } from "lucide-react";
import { useCallback, useState } from "react";
import { Button } from "@/ui/button";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/ui/dropdown-menu";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/ui/tooltip";
import { cn } from "@/utils/cn";

// ─── Types ────────────────────────────────────────────────────────────────────

export type DrawingTool = string;

// ─── Chart toolbar layout (top bar + left rail) ───────────────────────────────

/**
 * Top bar height — must stay `h-12` to match {@link chartLeftToolbarWidthClassName}
 * (`w-12`, 3rem). Do not add vertical padding on the bar; center controls with
 * `items-center` so the stripe stays square with the left rail at the corner.
 */
export const chartTopBarHeightClassName = "h-12 shrink-0";

export const chartLeftToolbarWidthClassName = "w-12";

/** Left-rail SVG scale only — top bar stays `size-4` on its own triggers. */
export const chartLeftToolbarSvgSizeClassName = "[&_svg]:size-5";

/**
 * Chart chrome: `Button variant="ghost"` uses `dark:hover:bg-muted/50`, which reads
 * flat next to custom triggers that use `hover:bg-muted`. Use this on ghost icon
 * buttons so dark hover matches dropdown triggers.
 */
export const chartToolbarGhostHoverClassName = "dark:hover:bg-muted";

/** Uniform 32×32 hit target for icon-only top-bar controls (chart type, screenshot, fullscreen). */
export const chartToolbarIconTriggerClassName = cn(
  "inline-flex size-8 shrink-0 cursor-pointer items-center justify-center rounded-md border-0 bg-transparent p-0 font-normal text-sm outline-none transition-colors hover:bg-muted",
  chartToolbarGhostHoverClassName
);

/** Text dropdown triggers — same row height as {@link chartToolbarIconTriggerClassName}. */
export const chartToolbarTextTriggerClassName = cn(
  "inline-flex h-8 shrink-0 cursor-pointer items-center rounded-md border-0 bg-transparent px-2.5 font-normal text-sm outline-none transition-colors hover:bg-muted",
  chartToolbarGhostHoverClassName
);

// ─── SVG Icons (from klinecharts/pro, Apache 2.0) ────────────────────────────
// All icons use viewBox="0 0 22 22" and fill-based rendering.

function IconHorizontalStraightLine() {
  return (
    <svg
      aria-hidden="true"
      className="size-4"
      fill="currentColor"
      viewBox="0 0 22 22"
    >
      <path d="M2 11h18v1H2z" />
    </svg>
  );
}
function IconHorizontalRayLine() {
  return (
    <svg
      aria-hidden="true"
      className="size-4"
      fill="currentColor"
      viewBox="0 0 22 22"
    >
      <path d="M2 11h18v1H2z" />
      <circle cx="3" cy="11.5" r="1.5" />
    </svg>
  );
}
function IconHorizontalSegment() {
  return (
    <svg
      aria-hidden="true"
      className="size-4"
      fill="currentColor"
      viewBox="0 0 22 22"
    >
      <path d="M2 11h18v1H2z" />
      <circle cx="3" cy="11.5" r="1.5" />
      <circle cx="19" cy="11.5" r="1.5" />
    </svg>
  );
}
function IconVerticalStraightLine() {
  return (
    <svg
      aria-hidden="true"
      className="size-4"
      fill="currentColor"
      viewBox="0 0 22 22"
    >
      <path d="M11 2v18h1V2z" />
    </svg>
  );
}
function IconVerticalRayLine() {
  return (
    <svg
      aria-hidden="true"
      className="size-4"
      fill="currentColor"
      viewBox="0 0 22 22"
    >
      <path d="M11 2v18h1V2z" />
      <circle cx="11.5" cy="3" r="1.5" />
    </svg>
  );
}
function IconVerticalSegment() {
  return (
    <svg
      aria-hidden="true"
      className="size-4"
      fill="currentColor"
      viewBox="0 0 22 22"
    >
      <path d="M11 2v18h1V2z" />
      <circle cx="11.5" cy="3" r="1.5" />
      <circle cx="11.5" cy="19" r="1.5" />
    </svg>
  );
}
function IconStraightLine() {
  return (
    <svg
      aria-hidden="true"
      className="size-4"
      fill="currentColor"
      viewBox="0 0 22 22"
    >
      <path d="M3.5 18.5l15-15 .707.707-15 15z" />
    </svg>
  );
}
function IconRayLine() {
  return (
    <svg
      aria-hidden="true"
      className="size-4"
      fill="currentColor"
      viewBox="0 0 22 22"
    >
      <path d="M3.5 18.5l15-15 .707.707-15 15z" />
      <circle cx="4.2" cy="17.8" r="1.5" />
    </svg>
  );
}
function IconSegment() {
  return (
    <svg
      aria-hidden="true"
      className="size-4"
      fill="currentColor"
      viewBox="0 0 22 22"
    >
      <path d="M3.5 18.5l15-15 .707.707-15 15z" />
      <circle cx="4.2" cy="17.8" r="1.5" />
      <circle cx="17.8" cy="4.2" r="1.5" />
    </svg>
  );
}
function IconArrow() {
  return (
    <svg
      aria-hidden="true"
      className="size-4"
      fill="currentColor"
      viewBox="0 0 22 22"
    >
      <path d="M4 18L18 4l-5 .5 4.5 4.5L18 4z" />
      <path d="M4 18l14-14" fill="none" stroke="currentColor" strokeWidth="1" />
    </svg>
  );
}
function IconPriceLine() {
  return (
    <svg
      aria-hidden="true"
      className="size-4"
      fill="currentColor"
      viewBox="0 0 22 22"
    >
      <path d="M2 11h14v1H2z" />
      <rect height="4" rx="0.5" width="4" x="16" y="9" />
    </svg>
  );
}

function IconPriceChannelLine() {
  return (
    <svg
      aria-hidden="true"
      className="size-4"
      fill="currentColor"
      viewBox="0 0 22 22"
    >
      <path
        d="M2 7l18 4M2 11l18 4"
        fill="none"
        stroke="currentColor"
        strokeWidth="1"
      />
    </svg>
  );
}
function IconParallelStraightLine() {
  return (
    <svg
      aria-hidden="true"
      className="size-4"
      fill="currentColor"
      viewBox="0 0 22 22"
    >
      <path
        d="M2 6l18 4M2 12l18 4"
        fill="none"
        stroke="currentColor"
        strokeWidth="1"
      />
    </svg>
  );
}
function IconCircle() {
  return (
    <svg
      aria-hidden="true"
      className="size-4"
      fill="none"
      stroke="currentColor"
      strokeWidth="1"
      viewBox="0 0 22 22"
    >
      <circle cx="11" cy="11" r="7" />
    </svg>
  );
}
function IconRect() {
  return (
    <svg
      aria-hidden="true"
      className="size-4"
      fill="none"
      stroke="currentColor"
      strokeWidth="1"
      viewBox="0 0 22 22"
    >
      <rect height="12" width="16" x="3" y="5" />
    </svg>
  );
}
function IconParallelogram() {
  return (
    <svg
      aria-hidden="true"
      className="size-4"
      fill="none"
      stroke="currentColor"
      strokeWidth="1"
      viewBox="0 0 22 22"
    >
      <path d="M5 17L8 5h9l-3 12z" />
    </svg>
  );
}
function IconTriangle() {
  return (
    <svg
      aria-hidden="true"
      className="size-4"
      fill="none"
      stroke="currentColor"
      strokeWidth="1"
      viewBox="0 0 22 22"
    >
      <path d="M11 4L20 18H2z" />
    </svg>
  );
}
function IconFibonacciLine() {
  return (
    <svg
      aria-hidden="true"
      className="size-4"
      fill="currentColor"
      viewBox="0 0 22 22"
    >
      <path d="M2 5h18v1H2zM2 9h18v1H2zM2 13h18v1H2zM2 17h18v1H2z" />
    </svg>
  );
}
function IconFibonacciSegment() {
  return (
    <svg
      aria-hidden="true"
      className="size-4"
      fill="currentColor"
      viewBox="0 0 22 22"
    >
      <path d="M2 5h18v1H2zM2 11h18v1H2zM2 17h18v1H2z" />
      <circle cx="3" cy="5.5" r="1.2" />
      <circle cx="19" cy="17.5" r="1.2" />
    </svg>
  );
}
function IconFibonacciCircle() {
  return (
    <svg
      aria-hidden="true"
      className="size-4"
      fill="none"
      stroke="currentColor"
      strokeWidth="1"
      viewBox="0 0 22 22"
    >
      <circle cx="11" cy="11" r="4" />
      <circle cx="11" cy="11" r="7" />
      <circle cx="11" cy="11" fill="currentColor" r="1" />
    </svg>
  );
}
function IconFibonacciSpiral() {
  return (
    <svg
      aria-hidden="true"
      className="size-4"
      fill="none"
      stroke="currentColor"
      strokeWidth="1"
      viewBox="0 0 22 22"
    >
      <path d="M11 11 Q11 4 18 4 Q18 18 4 18 Q4 8 11 8 Q14 8 14 11 Q14 14 11 14 Q9 14 9 11" />
    </svg>
  );
}
function IconFibonacciSpeedResistanceFan() {
  return (
    <svg
      aria-hidden="true"
      className="size-4"
      fill="currentColor"
      viewBox="0 0 22 22"
    >
      <path d="M3 19L19 3l.7.7L3.7 19.7z" />
      <path d="M3 19L19 11l.5.9L3.5 19.9z" />
      <path d="M3 19L19 19v1H3z" />
    </svg>
  );
}
function IconFibonacciExtension() {
  return (
    <svg
      aria-hidden="true"
      className="size-4"
      fill="currentColor"
      viewBox="0 0 22 22"
    >
      <path d="M2 6h18v1H2zM2 10h18v1H2zM2 14h18v1H2zM2 18h18v1H2z" />
      <circle cx="3" cy="6.5" r="1.2" />
      <circle cx="19" cy="10.5" r="1.2" />
    </svg>
  );
}
function IconGannBox() {
  return (
    <svg
      aria-hidden="true"
      className="size-4"
      fill="none"
      stroke="currentColor"
      strokeWidth="1"
      viewBox="0 0 22 22"
    >
      <rect height="16" width="16" x="3" y="3" />
      <path d="M3 3L19 19M3 19L19 3M11 3v16M3 11h16" />
    </svg>
  );
}

function IconXabcd() {
  return (
    <svg
      aria-hidden="true"
      className="size-4"
      fill="currentColor"
      viewBox="0 0 22 22"
    >
      <path
        d="M3 17l4-8 4 4 4-8 4 4"
        fill="none"
        stroke="currentColor"
        strokeWidth="1"
      />
      <circle cx="3" cy="17" r="1.2" />
      <circle cx="7" cy="9" r="1.2" />
      <circle cx="11" cy="13" r="1.2" />
      <circle cx="15" cy="5" r="1.2" />
      <circle cx="19" cy="9" r="1.2" />
    </svg>
  );
}
function IconAbcd() {
  return (
    <svg
      aria-hidden="true"
      className="size-4"
      fill="currentColor"
      viewBox="0 0 22 22"
    >
      <path
        d="M4 16l5-8 5 6 5-6"
        fill="none"
        stroke="currentColor"
        strokeWidth="1"
      />
      <circle cx="4" cy="16" r="1.2" />
      <circle cx="9" cy="8" r="1.2" />
      <circle cx="14" cy="14" r="1.2" />
      <circle cx="19" cy="8" r="1.2" />
    </svg>
  );
}
function IconThreeWaves() {
  return (
    <svg
      aria-hidden="true"
      className="size-4"
      fill="currentColor"
      viewBox="0 0 22 22"
    >
      <path
        d="M3 15l4-8 3 5 3-5 4 8"
        fill="none"
        stroke="currentColor"
        strokeWidth="1"
      />
    </svg>
  );
}
function IconFiveWaves() {
  return (
    <svg
      aria-hidden="true"
      className="size-4"
      fill="currentColor"
      viewBox="0 0 22 22"
    >
      <path
        d="M2 15l3-7 2 4 2-4 2 4 2-4 3 7"
        fill="none"
        stroke="currentColor"
        strokeWidth="1"
      />
    </svg>
  );
}
function IconEightWaves() {
  return (
    <svg
      aria-hidden="true"
      className="size-4"
      fill="currentColor"
      viewBox="0 0 22 22"
    >
      <path
        d="M2 14l2-5 1.5 3 1.5-3 1.5 3 1.5-3 1.5 3 1.5-3 1.5 3 1.5-3 2 5"
        fill="none"
        stroke="currentColor"
        strokeWidth="1"
      />
    </svg>
  );
}
function IconAnyWaves() {
  return (
    <svg
      aria-hidden="true"
      className="size-4"
      fill="currentColor"
      viewBox="0 0 22 22"
    >
      <path
        d="M2 14l3-6 2 4 2-4 2 4 2-4 3 6"
        fill="none"
        stroke="currentColor"
        strokeWidth="1"
      />
      <circle cx="19" cy="14" r="1.5" />
    </svg>
  );
}
function IconLock() {
  return (
    <svg
      aria-hidden="true"
      className="size-4"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.2"
      viewBox="0 0 22 22"
    >
      <rect height="9" rx="1" width="12" x="5" y="10" />
      <path d="M8 10V7a3 3 0 016 0v3" />
    </svg>
  );
}
function IconVisible() {
  return (
    <svg
      aria-hidden="true"
      className="size-4"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.2"
      viewBox="0 0 22 22"
    >
      <path d="M2 11s3-6 9-6 9 6 9 6-3 6-9 6-9-6-9-6z" />
      <circle cx="11" cy="11" r="2.5" />
    </svg>
  );
}
function IconEraser() {
  return (
    <svg
      aria-hidden="true"
      className="size-4"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.2"
      viewBox="0 0 22 22"
    >
      <path d="M3 18l5-5 7-7 4 4-7 7-5 5z" />
      <path d="M8 13l3 3" />
    </svg>
  );
}
function IconPointer() {
  return (
    <svg
      aria-hidden="true"
      className="size-4"
      fill="currentColor"
      viewBox="0 0 22 22"
    >
      <path d="M5 3l12 8-6 1-3 6z" />
    </svg>
  );
}

/** TradingView-style candlestick icon — two candles with wicks */
export function IconCandle() {
  return (
    <svg
      aria-hidden="true"
      className="size-4"
      fill="currentColor"
      viewBox="0 0 28 28"
    >
      {/* Left candle: bearish (filled body) */}
      <rect height="12" rx="0.5" width="6" x="5" y="6" />
      <line
        stroke="currentColor"
        strokeWidth="1.5"
        x1="8"
        x2="8"
        y1="3"
        y2="6"
      />
      <line
        stroke="currentColor"
        strokeWidth="1.5"
        x1="8"
        x2="8"
        y1="18"
        y2="24"
      />
      {/* Right candle: bullish (smaller) */}
      <rect height="8" rx="0.5" width="6" x="17" y="10" />
      <line
        stroke="currentColor"
        strokeWidth="1.5"
        x1="20"
        x2="20"
        y1="5"
        y2="10"
      />
      <line
        stroke="currentColor"
        strokeWidth="1.5"
        x1="20"
        x2="20"
        y1="18"
        y2="22"
      />
    </svg>
  );
}

/** TradingView-style line chart icon — zigzag line */
export function IconLine() {
  return (
    <svg
      aria-hidden="true"
      className="size-4"
      fill="none"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="1.8"
      viewBox="0 0 28 28"
    >
      <polyline points="3,20 9,12 15,16 25,6" />
    </svg>
  );
}

/** Hollow candle icon — two candles with stroked (hollow) bodies */
function IconHollowCandle() {
  return (
    <svg
      aria-hidden="true"
      className="size-4"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      viewBox="0 0 28 28"
    >
      <rect height="12" rx="0.5" width="6" x="5" y="6" />
      <line x1="8" x2="8" y1="3" y2="6" />
      <line x1="8" x2="8" y1="18" y2="24" />
      <rect height="8" rx="0.5" width="6" x="17" y="10" />
      <line x1="20" x2="20" y1="5" y2="10" />
      <line x1="20" x2="20" y1="18" y2="22" />
    </svg>
  );
}

/** OHLC bars icon — two bars with open/close ticks */
function IconOHLC() {
  return (
    <svg
      aria-hidden="true"
      className="size-4"
      fill="none"
      stroke="currentColor"
      strokeLinecap="round"
      strokeWidth="1.5"
      viewBox="0 0 28 28"
    >
      {/* Left bar */}
      <line x1="8" x2="8" y1="3" y2="24" />
      <line x1="4" x2="8" y1="8" y2="8" />
      <line x1="8" x2="12" y1="18" y2="18" />
      {/* Right bar */}
      <line x1="20" x2="20" y1="5" y2="22" />
      <line x1="16" x2="20" y1="12" y2="12" />
      <line x1="20" x2="24" y1="16" y2="16" />
    </svg>
  );
}

// ─── Chart type picker ────────────────────────────────────────────────────────

/** Chart display types */
export type ChartDisplayType = "line" | "candle" | "hollow_candle" | "ohlc";

const CHART_DISPLAY_TYPES: {
  id: ChartDisplayType;
  label: string;
  icon: React.ReactNode;
}[] = [
  { id: "line", label: "Line", icon: <IconLine /> },
  { id: "candle", label: "Candles", icon: <IconCandle /> },
  { id: "hollow_candle", label: "Hollow Candles", icon: <IconHollowCandle /> },
  { id: "ohlc", label: "OHLC", icon: <IconOHLC /> },
];

interface ChartTypePickerProps {
  chartType: ChartDisplayType;
  onChartTypeChange: (type: ChartDisplayType) => void;
}

export function ChartTypePicker({
  chartType,
  onChartTypeChange,
}: ChartTypePickerProps) {
  const active =
    CHART_DISPLAY_TYPES.find((t) => t.id === chartType) ??
    CHART_DISPLAY_TYPES[0];

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        className={cn(chartToolbarIconTriggerClassName, "text-text-primary")}
      >
        {active.icon}
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-44" side="bottom">
        {CHART_DISPLAY_TYPES.map((t) => (
          <DropdownMenuCheckboxItem
            checked={chartType === t.id}
            className="gap-2 text-xs"
            key={t.id}
            onCheckedChange={() => onChartTypeChange(t.id)}
          >
            <span className="flex size-4 items-center justify-center">
              {t.icon}
            </span>
            {t.label}
          </DropdownMenuCheckboxItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

// ─── Tool group definitions ───────────────────────────────────────────────────

interface ToolItem {
  icon: React.ReactNode;
  id: string;
  label: string;
}

interface ToolGroup {
  defaultTool: string;
  id: string;
  tools: ToolItem[];
}

const TOOL_GROUPS: ToolGroup[] = [
  {
    id: "singleLine",
    defaultTool: "horizontalStraightLine",
    tools: [
      {
        id: "horizontalStraightLine",
        label: "Horizontal Line",
        icon: <IconHorizontalStraightLine />,
      },
      {
        id: "horizontalRayLine",
        label: "Horizontal Ray",
        icon: <IconHorizontalRayLine />,
      },
      {
        id: "horizontalSegment",
        label: "Horizontal Segment",
        icon: <IconHorizontalSegment />,
      },
      {
        id: "verticalStraightLine",
        label: "Vertical Line",
        icon: <IconVerticalStraightLine />,
      },
      {
        id: "verticalRayLine",
        label: "Vertical Ray",
        icon: <IconVerticalRayLine />,
      },
      {
        id: "verticalSegment",
        label: "Vertical Segment",
        icon: <IconVerticalSegment />,
      },
      { id: "straightLine", label: "Trend Line", icon: <IconStraightLine /> },
      { id: "rayLine", label: "Ray", icon: <IconRayLine /> },
      { id: "segment", label: "Segment", icon: <IconSegment /> },
      { id: "arrow", label: "Arrow", icon: <IconArrow /> },
      { id: "priceLine", label: "Price Line", icon: <IconPriceLine /> },
    ],
  },
  {
    id: "moreLine",
    defaultTool: "priceChannelLine",
    tools: [
      {
        id: "priceChannelLine",
        label: "Price Channel",
        icon: <IconPriceChannelLine />,
      },
      {
        id: "parallelStraightLine",
        label: "Parallel Lines",
        icon: <IconParallelStraightLine />,
      },
    ],
  },
  {
    id: "polygon",
    defaultTool: "circle",
    tools: [
      { id: "circle", label: "Circle", icon: <IconCircle /> },
      { id: "rect", label: "Rectangle", icon: <IconRect /> },
      {
        id: "parallelogram",
        label: "Parallelogram",
        icon: <IconParallelogram />,
      },
      { id: "triangle", label: "Triangle", icon: <IconTriangle /> },
    ],
  },
  {
    id: "fibonacci",
    defaultTool: "fibonacciLine",
    tools: [
      {
        id: "fibonacciLine",
        label: "Fibonacci Retracement",
        icon: <IconFibonacciLine />,
      },
      {
        id: "fibonacciSegment",
        label: "Fibonacci Segment",
        icon: <IconFibonacciSegment />,
      },
      {
        id: "fibonacciCircle",
        label: "Fibonacci Circle",
        icon: <IconFibonacciCircle />,
      },
      {
        id: "fibonacciSpiral",
        label: "Fibonacci Spiral",
        icon: <IconFibonacciSpiral />,
      },
      {
        id: "fibonacciSpeedResistanceFan",
        label: "Speed Resistance Fan",
        icon: <IconFibonacciSpeedResistanceFan />,
      },
      {
        id: "fibonacciExtension",
        label: "Fibonacci Extension",
        icon: <IconFibonacciExtension />,
      },
      { id: "gannBox", label: "Gann Box", icon: <IconGannBox /> },
    ],
  },
  {
    id: "wave",
    defaultTool: "xabcd",
    tools: [
      { id: "xabcd", label: "XABCD Pattern", icon: <IconXabcd /> },
      { id: "abcd", label: "ABCD Pattern", icon: <IconAbcd /> },
      { id: "threeWaves", label: "Three Waves", icon: <IconThreeWaves /> },
      { id: "fiveWaves", label: "Five Waves", icon: <IconFiveWaves /> },
      { id: "eightWaves", label: "Eight Waves", icon: <IconEightWaves /> },
      { id: "anyWaves", label: "Any Waves", icon: <IconAnyWaves /> },
    ],
  },
];

// ─── ToolGroupButton ──────────────────────────────────────────────────────────

interface ToolGroupButtonProps {
  activeTool: DrawingTool;
  group: ToolGroup;
  onToolSelect: (tool: DrawingTool) => void;
}

function ToolGroupButton({
  group,
  activeTool,
  onToolSelect,
}: ToolGroupButtonProps) {
  const selected = group.tools[0];
  const isGroupActive = group.tools.some((t) => t.id === activeTool);

  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <Button
            aria-label={selected.label}
            className={cn(
              "rounded-sm p-0",
              isGroupActive && "bg-surface-3 text-text-primary"
            )}
            onClick={() => onToolSelect(selected.id)}
            size="icon-lg"
            type="button"
            variant="ghost"
          />
        }
      >
        {selected.icon}
      </TooltipTrigger>
      <TooltipContent side="right">{selected.label}</TooltipContent>
    </Tooltip>
  );
}

// ─── KlineLeftToolbar ─────────────────────────────────────────────────────────

interface KlineLeftToolbarProps {
  activeTool: DrawingTool;
  onLockChange?: (locked: boolean) => void;
  onToolSelect: (tool: DrawingTool) => void;
  onVisibilityChange?: (visible: boolean) => void;
}

export function KlineLeftToolbar({
  activeTool,
  onToolSelect,
  onLockChange,
  onVisibilityChange,
}: KlineLeftToolbarProps) {
  const [locked, setLocked] = useState(false);
  const [overlaysVisible, setOverlaysVisible] = useState(true);

  const handleLock = useCallback(() => {
    setLocked((prev) => {
      const next = !prev;
      onLockChange?.(next);
      return next;
    });
  }, [onLockChange]);

  const handleOverlaysVisible = useCallback(() => {
    setOverlaysVisible((prev) => {
      const next = !prev;
      onVisibilityChange?.(next);
      return next;
    });
  }, [onVisibilityChange]);

  const handleEraser = useCallback(() => {
    onToolSelect("eraser");
  }, [onToolSelect]);

  return (
    <div
      className={cn(
        "flex shrink-0 flex-col items-center gap-0.5 border-border-frame border-r py-1",
        chartLeftToolbarSvgSizeClassName,
        chartLeftToolbarWidthClassName
      )}
    >
      <Tooltip>
        <TooltipTrigger
          render={
            <Button
              aria-label="Pointer"
              className={cn(
                "rounded-sm p-0",
                activeTool === "pointer" && "bg-surface-3 text-text-primary"
              )}
              onClick={() => onToolSelect("pointer")}
              size="icon-lg"
              type="button"
              variant="ghost"
            />
          }
        >
          <IconPointer />
        </TooltipTrigger>
        <TooltipContent side="right">Pointer</TooltipContent>
      </Tooltip>

      {TOOL_GROUPS.map((group) => (
        <ToolGroupButton
          activeTool={activeTool}
          group={group}
          key={group.id}
          onToolSelect={onToolSelect}
        />
      ))}

      <Tooltip>
        <TooltipTrigger
          render={
            <Button
              aria-label={locked ? "Unlock overlays" : "Lock overlays"}
              className={cn(
                "rounded-sm p-0",
                locked && "bg-surface-3 text-doji-green"
              )}
              onClick={handleLock}
              size="icon-lg"
              type="button"
              variant="ghost"
            />
          }
        >
          <IconLock />
        </TooltipTrigger>
        <TooltipContent side="right">
          {locked ? "Unlock overlays" : "Lock overlays"}
        </TooltipContent>
      </Tooltip>

      <Tooltip>
        <TooltipTrigger
          render={
            <Button
              aria-label={overlaysVisible ? "Hide overlays" : "Show overlays"}
              className={cn(
                "rounded-sm p-0",
                !overlaysVisible && "text-text-muted"
              )}
              onClick={handleOverlaysVisible}
              size="icon-lg"
              type="button"
              variant="ghost"
            />
          }
        >
          <IconVisible />
        </TooltipTrigger>
        <TooltipContent side="right">
          {overlaysVisible ? "Hide overlays" : "Show overlays"}
        </TooltipContent>
      </Tooltip>

      <Tooltip>
        <TooltipTrigger
          render={
            <Button
              aria-label="Remove all drawings"
              className="rounded-sm p-0"
              onClick={handleEraser}
              size="icon-lg"
              type="button"
              variant="ghost"
            />
          }
        >
          <IconEraser />
        </TooltipTrigger>
        <TooltipContent side="right">Remove all drawings</TooltipContent>
      </Tooltip>
    </div>
  );
}

// ─── KlineTopBarExtras ────────────────────────────────────────────────────────

/** Ref to chart wrapper exposing `getChart()` (e.g. PolymarketKLineChartInner handle). */
interface KlineChartHandleRef {
  getChart: () => Chart | null;
}

interface KlineTopBarExtrasProps {
  chartHandleRef: React.RefObject<KlineChartHandleRef | null>;
  containerRef: React.RefObject<HTMLDivElement | null>;
}

export function KlineTopBarExtras({
  chartHandleRef,
  containerRef,
}: KlineTopBarExtrasProps) {
  return (
    <>
      <KlineScreenshotButton chartHandleRef={chartHandleRef} />
      <KlineFullscreenButton containerRef={containerRef} />
    </>
  );
}

interface KlineScreenshotButtonProps {
  chartHandleRef: React.RefObject<KlineChartHandleRef | null>;
}

export function KlineScreenshotButton({
  chartHandleRef,
}: KlineScreenshotButtonProps) {
  const handleScreenshot = useCallback(() => {
    const chart = chartHandleRef.current?.getChart() ?? null;
    if (!chart) {
      return;
    }
    try {
      const url = chart.getConvertPictureUrl(true, "jpeg", "#1a1a1a");
      const a = document.createElement("a");
      a.href = url;
      a.download = `chart-${Date.now()}.jpeg`;
      a.click();
    } catch {
      // ignore
    }
  }, [chartHandleRef]);

  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <Button
            aria-label="Take screenshot"
            className={cn(
              "size-8 shrink-0 rounded-md p-0 text-text-secondary transition-colors hover:text-text-primary",
              chartToolbarGhostHoverClassName
            )}
            onClick={handleScreenshot}
            size="icon-lg"
            type="button"
            variant="ghost"
          />
        }
      >
        <Camera className="size-4" />
      </TooltipTrigger>
      <TooltipContent>Screenshot</TooltipContent>
    </Tooltip>
  );
}

interface KlineFullscreenButtonProps {
  containerRef: React.RefObject<HTMLDivElement | null>;
}

export function KlineFullscreenButton({
  containerRef,
}: KlineFullscreenButtonProps) {
  const handleFullscreen = useCallback(() => {
    const el = containerRef.current;
    if (!el) {
      return;
    }
    if (document.fullscreenElement) {
      document.exitFullscreen().catch(() => {
        /* ignore fullscreen exit errors */
      });
    } else {
      el.requestFullscreen().catch(() => {
        /* ignore fullscreen request errors */
      });
    }
  }, [containerRef]);

  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <Button
            aria-label="Toggle fullscreen"
            className={cn(
              "size-8 shrink-0 rounded-md p-0 text-text-secondary transition-colors hover:text-text-primary",
              chartToolbarGhostHoverClassName
            )}
            onClick={handleFullscreen}
            size="icon-lg"
            type="button"
            variant="ghost"
          />
        }
      >
        <Maximize2 className="size-4" />
      </TooltipTrigger>
      <TooltipContent>Fullscreen</TooltipContent>
    </Tooltip>
  );
}
