"use client";

import { cn } from "@/utils/cn";

/**
 * Selector chip — timescale, filter, and toggle chip buttons.
 *
 * variant="default" (most usages): Inactive has subtle bg fill, no border. Active: doji green pill.
 * variant="minimal": Inactive = no bg, grey text. Active: doji green pill (e.g. portfolio cards).
 */
const selectorChipBase =
  "inline-flex shrink-0 cursor-pointer items-center justify-center rounded-full px-2 py-0 font-medium text-xs transition-colors";
const selectorChipActive = "bg-primary/15 text-primary hover:bg-primary/20";
const selectorChipInactiveDefault =
  "bg-surface-3 text-muted-foreground hover:bg-surface-4 hover:text-foreground";
const selectorChipInactiveMinimal =
  "bg-transparent text-muted-foreground hover:bg-accent hover:text-foreground";

export interface SelectorChipProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  active: boolean;
  children: React.ReactNode;
  /** sm = chart/timescale (h-6); md = filter chips (h-8); icon = square 24px; icon-lg = square 32px (explore toolbar) */
  size?: "sm" | "md" | "icon" | "icon-lg";
  /** default = border when inactive (leaderboard, explore, etc). minimal = border only when active (chart timescale) */
  variant?: "default" | "minimal";
}

export function SelectorChip({
  active,
  className,
  children,
  size = "sm",
  variant = "default",
  ...props
}: SelectorChipProps) {
  const inactiveClass =
    variant === "minimal"
      ? selectorChipInactiveMinimal
      : selectorChipInactiveDefault;
  return (
    <button
      className={cn(
        selectorChipBase,
        size === "sm" && "h-6",
        size === "md" && "h-8 px-3",
        size === "icon" && "size-6 p-0 [&_svg]:size-3.5",
        size === "icon-lg" && "size-8 p-0 [&_svg]:size-4",
        active ? selectorChipActive : inactiveClass,
        className
      )}
      type="button"
      {...props}
    >
      {children}
    </button>
  );
}

/** Shared classNames for custom compositions (e.g. Link styled as chip) */
export const selectorChipVariants = {
  base: selectorChipBase,
  active: selectorChipActive,
  inactive: selectorChipInactiveDefault,
  inactiveMinimal: selectorChipInactiveMinimal,
};

/** Neutral active pill — used where doji green is not appropriate (explore subtags, trades toolbar). */
export const selectorChipNeutralActive =
  "bg-surface-4 text-text-primary hover:bg-surface-4";
