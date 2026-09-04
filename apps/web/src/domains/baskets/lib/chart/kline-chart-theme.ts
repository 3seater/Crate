import type { DeepPartial, Styles } from "klinecharts";

import { getColorSell, getDojiGreen, hexToRgb } from "@/utils/doji-green";

/** Resolved app theme for KLineChart styling. */
export type KlineChartTheme = "light" | "dark";

/** Same RGBA as `grid.horizontal` / `vertical.color` in `getKlineChartStyles`. */
export const KLINE_CHART_GRID_COLOR: Record<KlineChartTheme, string> = {
  dark: "rgba(255, 255, 255, 0.04)",
  light: "rgba(0, 0, 0, 0.06)",
};

/**
 * Brighter sweep for the chart loader mark (same channel as grid; readable on canvas).
 */
export const KLINE_CHART_LOADER_SWEEP_COLOR: Record<KlineChartTheme, string> = {
  dark: "rgba(255, 255, 255, 0.12)",
  light: "rgba(0, 0, 0, 0.14)",
};

export function resolveKlineChartTheme(): KlineChartTheme {
  return "dark";
}

/**
 * KLineChart v10 styles aligned with Doji tokens (`apps/web/src/index.css`).
 */
export function getKlineChartStyles(
  theme: KlineChartTheme
): DeepPartial<Styles> {
  const up = getDojiGreen();
  const down = getColorSell();
  const { r, g, b } = hexToRgb(up);
  const isDark = theme === "dark";
  const gridColor = KLINE_CHART_GRID_COLOR[theme];
  const textMuted = isDark ? "rgba(255, 255, 255, 0.5)" : "rgba(0, 0, 0, 0.6)";
  const cross = isDark ? "rgba(255, 255, 255, 0.2)" : "rgba(0, 0, 0, 0.2)";
  const labelBg = isDark ? "#2a2a2a" : "#e5e5e5";

  const AXIS_FONT_SIZE = 12;
  /** Cross-platform font stack — Helvetica Neue (macOS) → Helvetica → Arial (Windows) → sans-serif. */
  const FONT_FAMILY = "Helvetica Neue, Helvetica, Arial, sans-serif";

  return {
    grid: {
      show: true,
      horizontal: { show: true, color: gridColor },
      vertical: { show: true, color: gridColor },
    },
    xAxis: {
      show: true,
      axisLine: { show: true, color: gridColor },
      tickLine: { show: true, color: gridColor },
      tickText: {
        show: true,
        color: textMuted,
        weight: "normal",
        size: AXIS_FONT_SIZE,
        family: FONT_FAMILY,
        marginStart: 4,
        marginEnd: 4,
      },
    },
    yAxis: {
      show: true,
      size: 60,
      axisLine: { show: true, color: gridColor },
      tickLine: { show: true, color: gridColor },
      tickText: {
        show: true,
        color: textMuted,
        weight: "normal",
        size: AXIS_FONT_SIZE,
        family: FONT_FAMILY,
        marginStart: 4,
        marginEnd: 4,
      },
    },
    crosshair: {
      show: true,
      horizontal: {
        show: true,
        line: { show: true, style: "dashed", color: cross, size: 1 },
        text: {
          show: true,
          color: textMuted,
          backgroundColor: labelBg,
          borderColor: gridColor,
          borderSize: 1,
          borderRadius: 2,
          paddingLeft: 4,
          paddingRight: 4,
          paddingTop: 2,
          paddingBottom: 2,
          weight: "normal",
          size: AXIS_FONT_SIZE,
          family: FONT_FAMILY,
        },
        features: [],
      },
      vertical: {
        show: true,
        line: { show: true, style: "dashed", color: cross, size: 1 },
        text: {
          show: true,
          color: textMuted,
          backgroundColor: labelBg,
          borderColor: gridColor,
          borderSize: 1,
          borderRadius: 2,
          paddingLeft: 4,
          paddingRight: 4,
          paddingTop: 2,
          paddingBottom: 2,
          weight: "normal",
          size: AXIS_FONT_SIZE,
          family: FONT_FAMILY,
        },
      },
    },
    candle: {
      type: "candle_solid",
      bar: {
        compareRule: "previous_close",
        upColor: up,
        downColor: down,
        noChangeColor: up,
        upBorderColor: up,
        downBorderColor: down,
        noChangeBorderColor: up,
        upWickColor: up,
        downWickColor: down,
        noChangeWickColor: up,
      },
      priceMark: {
        show: true,
        high: { show: false },
        low: { show: false },
        last: {
          show: true,
          upColor: up,
          downColor: up,
          noChangeColor: up,
          line: { show: true, style: "dashed", size: 1 },
          text: {
            show: true,
            color: "#000000",
            size: AXIS_FONT_SIZE,
            family: FONT_FAMILY,
            paddingLeft: 4,
            paddingRight: 4,
            paddingTop: 2,
            paddingBottom: 2,
          },
        },
      },
      /** Top strip (ticker · period · OHLC); Polymarket uses token ids — hide for cleaner UI. */
      tooltip: {
        showRule: "none",
      },
      area: {
        lineSize: 2,
        lineColor: up,
        smooth: true,
        backgroundColor: "transparent",
        point: {
          show: true,
          color: up,
          radius: 3,
          rippleColor: `rgba(${r}, ${g}, ${b}, 0.25)`,
          rippleRadius: 3,
          animation: false,
          animationDuration: 0,
        },
      },
    },
    indicator: {
      ohlc: {
        upColor: up,
        downColor: down,
        noChangeColor: textMuted,
      },
      bars: [
        {
          upColor: `rgba(${r}, ${g}, ${b}, 0.7)`,
          downColor: `rgba(${hexToRgb(down).r}, ${hexToRgb(down).g}, ${hexToRgb(down).b}, 0.7)`,
          noChangeColor: `rgba(${r}, ${g}, ${b}, 0.7)`,
        },
      ],
      circles: [
        {
          upColor: up,
          downColor: down,
          noChangeColor: textMuted,
        },
      ],
      lastValueMark: {
        show: false,
      },
      tooltip: {
        showRule: "follow_cross",
      },
    },
    separator: {
      size: 1,
      color: gridColor,
      fill: true,
      activeBackgroundColor: isDark
        ? "rgba(255, 255, 255, 0.08)"
        : "rgba(0, 0, 0, 0.08)",
    },
  };
}
