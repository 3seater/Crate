"use client";

import type { OhlcvCandle } from "@doji/types";
import type { Chart, KLineData } from "klinecharts";
import { dispose, init } from "klinecharts";
import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from "react";
import {
  getKlineChartStyles,
  resolveKlineChartTheme,
} from "@/domains/baskets/lib/chart/kline-chart-theme";
import { createRobustCandleYAxisRange } from "@/domains/baskets/lib/chart/kline-chart-y-axis";
import { registerProOverlays } from "@/domains/baskets/lib/chart/kline-pro-overlays";
import type { ChartDisplayType } from "@/domains/baskets/lib/chart/kline-toolbar";
import {
  ChartTypePicker,
  chartLeftToolbarWidthClassName,
  chartTopBarHeightClassName,
  KlineLeftToolbar,
} from "@/domains/baskets/lib/chart/kline-toolbar";
import { cn } from "@/utils/cn";

function toKlineCandleType(
  t: ChartDisplayType
): "area" | "candle_solid" | "candle_stroke" | "ohlc" {
  switch (t) {
    case "line":
      return "area";
    case "hollow_candle":
      return "candle_stroke";
    case "ohlc":
      return "ohlc";
    default:
      return "candle_solid";
  }
}

export interface TokenCandlestickChartHandle {
  getChart: () => Chart | null;
}

interface TokenCandlestickChartProps {
  candles: OhlcvCandle[];
  chartType?: ChartDisplayType;
  height?: number;
  isLoading?: boolean;
  symbol: string;
}

export const TokenCandlestickChart = forwardRef<
  TokenCandlestickChartHandle,
  TokenCandlestickChartProps
>(function TokenCandlestickChart(
  { candles, chartType: chartTypeProp, height = 420, isLoading, symbol },
  ref
) {
  "use no memo";

  const containerRef = useRef<HTMLDivElement>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<Chart | null>(null);
  const [chartType, setChartType] = useState<ChartDisplayType>(
    chartTypeProp ?? "candle"
  );
  const chartTypeRef = useRef<ChartDisplayType>(chartTypeProp ?? "candle");
  const [activeTool, setActiveTool] = useState("pointer");
  const theme = resolveKlineChartTheme();

  useImperativeHandle(ref, () => ({
    getChart: () => chartRef.current,
  }));

  // Single effect: init chart AND load data together so we never miss candles
  useEffect(() => {
    const el = containerRef.current;
    if (!el) {
      return;
    }

    registerProOverlays();

    const initStyles = getKlineChartStyles(theme);
    if (initStyles.candle) {
      initStyles.candle.type = toKlineCandleType(chartTypeRef.current);
    }

    const chart = init(el, {
      layout: [
        {
          type: "candle",
          options: { axis: { createRange: createRobustCandleYAxisRange } },
        },
      ],
      timezone: "UTC",
      styles: initStyles,
    });

    if (!chart) {
      return;
    }
    chartRef.current = chart;

    chart.createIndicator("MA", true, { id: "candle_pane" });

    // Resize observer
    let rafId = 0;
    const ro = new ResizeObserver(() => {
      cancelAnimationFrame(rafId);
      rafId = requestAnimationFrame(() => chart.resize());
    });
    ro.observe(el);

    // Load data if candles are available
    if (candles.length > 0) {
      const klineData: KLineData[] = candles.map((c) => ({
        timestamp: c.timestamp * 1000,
        open: c.open,
        high: c.high,
        low: c.low,
        close: c.close,
        volume: c.volume,
      }));

      chart.setSymbol({
        ticker: symbol,
        pricePrecision: 8,
        volumePrecision: 2,
      });

      chart.setDataLoader({
        getBars: ({ callback }) => {
          queueMicrotask(() => {
            callback(klineData, { backward: false, forward: false });
            chart.setOffsetRightDistance(20);
            chart.scrollToRealTime(0);
          });
        },
      });

      // Trigger initial getBars call
      chart.setPeriod({ type: "hour", span: 1 });
    }

    return () => {
      cancelAnimationFrame(rafId);
      ro.disconnect();
      chartRef.current = null;
      dispose(chart);
    };
  }, [candles, symbol, theme]);

  // Chart type style update (doesn't recreate chart)
  useEffect(() => {
    const chart = chartRef.current;
    if (!chart) {
      return;
    }
    const styles = getKlineChartStyles(theme);
    if (styles.candle) {
      styles.candle.type = toKlineCandleType(chartType);
    }
    chart.setStyles(styles);
    chartTypeRef.current = chartType;
  }, [chartType, theme]);

  const handleToolSelect = useCallback((tool: string) => {
    setActiveTool(tool);
    const chart = chartRef.current;
    if (!chart) {
      return;
    }
    if (tool === "pointer") {
      return;
    }
    if (tool === "eraser") {
      chart.removeOverlay();
      return;
    }
    chart.createOverlay({ name: tool, groupId: "drawing" });
  }, []);

  const handleLockChange = useCallback((locked: boolean) => {
    chartRef.current?.setStyles?.({ overlay: { lock: locked } } as never);
  }, []);

  const handleVisibilityChange = useCallback((visible: boolean) => {
    if (!visible) {
      chartRef.current?.removeOverlay({ groupId: "drawing" });
    }
  }, []);

  if (isLoading) {
    return (
      <div style={{ height: height + 48 }}>
        <div
          className={cn(
            "flex items-center gap-2 border-border border-b px-3",
            chartTopBarHeightClassName
          )}
        >
          <ChartTypePicker
            chartType={chartType}
            onChartTypeChange={setChartType}
          />
        </div>
        <div
          aria-busy="true"
          className="animate-pulse bg-muted"
          role="status"
          style={{ height }}
        />
      </div>
    );
  }

  if (!isLoading && candles.length === 0) {
    return (
      <div
        className="flex items-center justify-center bg-muted/10 text-sm text-text-muted"
        style={{ height: height + 48 }}
      >
        No chart data for {symbol}
      </div>
    );
  }

  return (
    <div className="flex w-full flex-col" ref={wrapperRef}>
      {/* Chart + left toolbar */}
      <div className="flex" style={{ height }}>
        <KlineLeftToolbar
          activeTool={activeTool}
          onLockChange={handleLockChange}
          onToolSelect={handleToolSelect}
          onVisibilityChange={handleVisibilityChange}
        />
        <div
          className={cn("min-w-0 flex-1", chartLeftToolbarWidthClassName)}
          ref={containerRef}
          style={{ width: "calc(100% - 3rem)" }}
        />
      </div>
    </div>
  );
});
