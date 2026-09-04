"use client";

import { Slider as SliderPrimitive } from "@base-ui/react/slider";
import * as React from "react";

import { cn } from "@/utils/cn";

const DOT_POSITIONS = [0, 25, 50, 75, 100] as const;

/** Buy: --doji-green. Sell: --color-sell + --color-loss-70 (theme-derived tints). Split/Merge: --card-foreground. */
const THUMB_CLASSES = {
  buy: "shadow-[0_0_0_1.5px_var(--doji-green)] hover:shadow-[0_0_0_1.5px_var(--doji-green),0_0_0_5px_var(--doji-green-70)] data-[dragging]:shadow-[0_0_0_1.5px_var(--doji-green),0_0_0_6px_var(--doji-green-70)]",
  sell: "shadow-[0_0_0_1.5px_var(--color-sell)] hover:shadow-[0_0_0_1.5px_var(--color-sell),0_0_0_5px_var(--color-loss-70)] data-[dragging]:shadow-[0_0_0_1.5px_var(--color-sell),0_0_0_6px_var(--color-loss-70)]",
  neutral:
    "shadow-[0_0_0_1.5px_var(--card-foreground)] hover:shadow-[0_0_0_1.5px_var(--card-foreground),0_0_0_5px_var(--card-foreground-70)] data-[dragging]:shadow-[0_0_0_1.5px_var(--card-foreground),0_0_0_6px_var(--card-foreground-70)]",
} as const;

type SliderProps = SliderPrimitive.Root.Props & {
  /** Override Indicator (filled bar) className. Use for split/merge neutral styling. */
  indicatorClassName?: string;
  /** Show dots along track that light up as value passes them. */
  dots?: boolean;
  /** Override lit dot color (e.g. bg-sell for SELL). Default: bg-primary */
  dotsLitClassName?: string;
  /** Thumb+range variant: buy (green), sell (red), neutral (white). Default: buy */
  variant?: "buy" | "sell" | "neutral";
};

function Slider({
  className,
  defaultValue,
  value,
  min = 0,
  max = 100,
  indicatorClassName,
  dots = false,
  dotsLitClassName,
  variant = "buy",
  ...props
}: SliderProps) {
  const _values = React.useMemo(
    () =>
      Array.isArray(value)
        ? value
        : // biome-ignore lint/style/noNestedTernary: readable value/defaultValue/fallback chain
          Array.isArray(defaultValue)
          ? defaultValue
          : [min, max],
    [value, defaultValue, min, max]
  );
  const currentVal = _values[0] ?? min;

  return (
    <SliderPrimitive.Root
      className={cn(
        "overflow-visible data-vertical:h-full data-horizontal:w-full data-dragging:cursor-grabbing",
        className
      )}
      data-slot="slider"
      defaultValue={defaultValue}
      max={max}
      min={min}
      value={value}
      {...props}
    >
      <SliderPrimitive.Control className="relative flex w-full touch-none select-none items-center overflow-visible data-disabled:pointer-events-none data-vertical:h-full data-vertical:min-h-40 data-vertical:w-auto data-dragging:cursor-grabbing data-vertical:flex-col data-disabled:opacity-50">
        <SliderPrimitive.Track
          className="relative grow select-none overflow-visible rounded-md bg-surface-2 data-horizontal:h-1.5 data-vertical:h-full data-horizontal:w-full data-vertical:w-3 data-horizontal:rounded-md"
          data-slot="slider-track"
        >
          <SliderPrimitive.Indicator
            className={cn(
              "select-none rounded-md data-horizontal:h-full data-vertical:w-full",
              indicatorClassName ?? "bg-primary/30"
            )}
            data-slot="slider-range"
          />
          {dots &&
            DOT_POSITIONS.map((pos) => (
              <div
                aria-hidden
                className={cn(
                  "pointer-events-none absolute top-1/2 size-1.5 -translate-x-1/2 -translate-y-1/2 rounded-sm transition-colors duration-150",
                  pos === 0 && "left-0",
                  pos === 25 && "left-[25%]",
                  pos === 50 && "left-1/2",
                  pos === 75 && "left-[75%]",
                  pos === 100 && "left-full",
                  currentVal >= pos
                    ? (dotsLitClassName ?? "bg-primary")
                    : "bg-text-tertiary"
                )}
                key={pos}
              />
            ))}
        </SliderPrimitive.Track>
        {_values.map((thumbValue) => (
          <SliderPrimitive.Thumb
            className={cn(
              "block size-4 shrink-0 origin-center cursor-pointer select-none rounded-md border-0 bg-card ring-0 transition-[transform,box-shadow] duration-420 ease-in-out hover:scale-[1.15] focus-visible:outline-hidden disabled:pointer-events-none disabled:opacity-50 data-dragging:scale-[1.15] data-dragging:cursor-grabbing",
              THUMB_CLASSES[variant]
            )}
            data-slot="slider-thumb"
            key={`thumb-${thumbValue}`}
          />
        ))}
      </SliderPrimitive.Control>
    </SliderPrimitive.Root>
  );
}

export { Slider };
