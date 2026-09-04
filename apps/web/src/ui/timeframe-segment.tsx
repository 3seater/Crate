"use client";

import type { ComponentProps } from "react";
import { cn } from "@/utils/cn";

export type TimeframeSegmentProps = Omit<ComponentProps<"button">, "type"> & {
  active: boolean;
  variant?: "pill" | "ghost";
};

export function TimeframeSegment({
  active,
  className,
  variant = "pill",
  ...props
}: TimeframeSegmentProps) {
  return (
    <button
      className={cn(
        "inline-flex h-8 shrink-0 cursor-pointer items-center justify-center rounded-md bg-transparent px-2 py-1.5 font-medium text-sm transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40",
        variant === "pill" && "hover:bg-positive/10",
        active
          ? [variant === "pill" && "bg-positive/10", "text-primary"]
          : "group text-text-secondary hover:text-primary",
        className
      )}
      type="button"
      {...props}
    />
  );
}
