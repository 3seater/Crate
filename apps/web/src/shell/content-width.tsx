import { cva, type VariantProps } from "class-variance-authority";
import type { ComponentProps } from "react";
import { cn } from "@/utils/cn";

const contentWidthVariants = cva("w-full min-w-0", {
  variants: {
    variant: {
      narrow: "mx-auto max-w-2xl",
      default: "mx-auto max-w-4xl",
      wide: "mx-auto max-w-6xl",
      portfolio: "mx-auto max-w-[78rem] px-4 sm:px-6",
      explore: "mx-auto max-w-[90rem] px-4 sm:px-6",
      full: "max-w-none",
    },
  },
  defaultVariants: {
    variant: "default",
  },
});

export type ContentWidthProps = ComponentProps<"div"> &
  VariantProps<typeof contentWidthVariants>;

/**
 * Content width: single source of truth for max-width and horizontal padding.
 * Constrained pages (portfolio, leaderboard, profile, bridge) use narrow/default.
 * Discovery uses default or wide. Trading pages use full (no max-width).
 */
export function ContentWidth({
  variant,
  className,
  ...props
}: ContentWidthProps) {
  return (
    <div
      className={cn(contentWidthVariants({ variant }), className)}
      {...props}
    />
  );
}
