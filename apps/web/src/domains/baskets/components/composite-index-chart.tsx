"use client";

import type { CompositeIndexPoint } from "@doji/types";
import {
  Area,
  AreaChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

interface CompositeIndexChartProps {
  /** Optional basket USD value for the current moment — drives the "Index Price" display */
  currentUsdValue?: number;
  data: CompositeIndexPoint[];
  failedSymbols?: string[];
  isLoading?: boolean;
}

function formatDate(ts: number): string {
  const d = new Date(ts * 1000);
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

function formatTime(ts: number): string {
  const d = new Date(ts * 1000);
  return d.toLocaleTimeString(undefined, {
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function CompositeIndexChart({
  data,
  failedSymbols,
  isLoading,
  currentUsdValue,
}: CompositeIndexChartProps) {
  if (isLoading) {
    return (
      <div className="flex flex-col gap-3">
        <div className="flex items-end gap-3">
          <div
            className="h-8 w-32 bg-[color:var(--bg-surface-raised)]"
            data-slot="skeleton"
          />
          <div
            className="h-4 w-16 bg-[color:var(--bg-surface-raised)]"
            data-slot="skeleton"
          />
        </div>
        <div
          aria-busy="true"
          aria-label="Loading index chart"
          className="h-[240px] bg-[color:var(--bg-surface)]"
          data-slot="skeleton"
          role="status"
        />
      </div>
    );
  }

  if (data.length === 0) {
    return (
      <div className="flex h-[240px] items-center justify-center text-[color:var(--text-secondary)] text-sm">
        Chart data unavailable.
      </div>
    );
  }

  const first = data.at(0)?.value ?? 100;
  const last = data.at(-1)?.value ?? 100;
  const pctChange = ((last - first) / first) * 100;
  const isPositive = pctChange >= 0;

  const values = data.map((d) => d.value);

  const dataMin = Math.min(...values);
  const dataMax = Math.max(...values);
  const padding = (dataMax - dataMin) * 0.08 || 2;
  const domainMin = dataMin - padding;
  const domainMax = dataMax + padding;

  // Determine x-axis tick format based on time range
  const timeRangeHours =
    ((data.at(-1)?.timestamp ?? 0) - data[0].timestamp) / 3600;
  const tickFormatter = timeRangeHours <= 25 ? formatTime : formatDate;

  return (
    <div className="flex flex-col gap-2">
      {/* Index price header */}
      <div className="flex items-baseline gap-3 px-1">
        <div>
          <span className="font-medium text-3xl text-text-primary tabular-nums">
            {last.toFixed(2)}
          </span>
          <span className="ml-1 text-text-muted text-xs">pts</span>
        </div>
        {currentUsdValue != null && (
          <span className="text-sm text-text-secondary tabular-nums">
            ≈$
            {currentUsdValue.toLocaleString(undefined, {
              maximumFractionDigits: 2,
            })}
          </span>
        )}
        <span
          className={`font-medium text-sm tabular-nums ${isPositive ? "text-positive" : "text-destructive"}`}
        >
          {isPositive ? "+" : ""}
          {pctChange.toFixed(2)}%
        </span>
      </div>

      <ResponsiveContainer height={200} width="100%">
        <AreaChart
          data={data}
          margin={{ bottom: 0, left: -4, right: 4, top: 4 }}
        >
          <defs>
            <linearGradient id="indexGradient" x1="0" x2="0" y1="0" y2="1">
              <stop
                offset="0%"
                stopColor="var(--crate-orange)"
                stopOpacity={0.4}
              />
              <stop
                offset="100%"
                stopColor="var(--crate-orange)"
                stopOpacity={0}
              />
            </linearGradient>
          </defs>

          <XAxis
            dataKey="timestamp"
            minTickGap={60}
            stroke="var(--border-subtle)"
            tick={{ fill: "var(--text-secondary)", fontSize: 10 }}
            tickFormatter={tickFormatter}
            tickLine={false}
          />
          <YAxis
            axisLine={false}
            domain={[domainMin, domainMax]}
            tick={{ fill: "var(--text-secondary)", fontSize: 10 }}
            tickFormatter={(v: number) => v.toFixed(1)}
            tickLine={false}
            width={44}
          />

          {/* Baseline at period start (100) */}
          <ReferenceLine
            stroke="var(--border-subtle)"
            strokeDasharray="3 3"
            y={100}
          />

          <Tooltip
            contentStyle={{
              backgroundColor: "var(--bg-surface)",
              border: "1px solid var(--border-default)",
              borderRadius: "0px",
              fontSize: "11px",
              padding: "6px 10px",
            }}
            formatter={(val: unknown) =>
              [`${Number(val).toFixed(2)} pts`, "Index"] as [string, string]
            }
            labelFormatter={(label: unknown) => {
              const ts = Number(label);
              return `${formatDate(ts)} ${formatTime(ts)}`;
            }}
            labelStyle={{ color: "var(--muted-foreground)", marginBottom: 2 }}
          />

          <Area
            activeDot={{
              fill: "var(--crate-orange)",
              r: 3,
              strokeWidth: 0,
            }}
            dataKey="value"
            dot={false}
            fill="url(#indexGradient)"
            isAnimationActive={false}
            stroke="var(--crate-orange)"
            strokeWidth={1.5}
            type="monotone"
          />
        </AreaChart>
      </ResponsiveContainer>

      {failedSymbols && failedSymbols.length > 0 && (
        <p className="px-1 text-[10px] text-text-muted" role="alert">
          ⚠ No data for: {failedSymbols.join(", ")}
        </p>
      )}
    </div>
  );
}
