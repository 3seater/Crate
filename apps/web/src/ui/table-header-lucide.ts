/**
 * Shared Lucide size + stroke for sort arrows and funnel triggers in table headers
 * (leaderboard, explore markets, etc.).
 */
export const TABLE_HEADER_LUCIDE_ICON_CLASS = "size-3.5 shrink-0";

export const TABLE_HEADER_LUCIDE_STROKE_PROPS = {
  absoluteStrokeWidth: true,
  strokeWidth: 2,
} as const;

/** Label ↔ sort icon inside `SortableHeader`. */
export const TABLE_HEADER_CONTROLS_GAP_CLASS = "gap-1";

/**
 * Sort block ↔ funnel sibling: a hair tighter than `TABLE_HEADER_CONTROLS_GAP_CLASS`
 * so ink-to-ink matches label↔sort (funnel triggers use `justify-start` + fixed tap box).
 */
export const TABLE_HEADER_SORT_TO_FUNNEL_GAP_CLASS = "gap-px";

/**
 * Funnel trigger hit box — slightly smaller than the old `size-6` so the funnel
 * glyph sits closer to the sort icon (less “dead air” than label↔sort).
 */
export const TABLE_HEADER_FUNNEL_TAP_CLASS = "size-5";
