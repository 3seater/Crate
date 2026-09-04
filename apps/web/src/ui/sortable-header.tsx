"use client";

import { ArrowUpDown } from "lucide-react";
import {
  TABLE_HEADER_CONTROLS_GAP_CLASS,
  TABLE_HEADER_LUCIDE_ICON_CLASS,
  TABLE_HEADER_LUCIDE_STROKE_PROPS,
} from "@/ui/table-header-lucide";
import { cn } from "@/utils/cn";

export type SortDirection = "asc" | "desc";

/**
 * Lucide `ArrowUpDown` is four paths: 1–2 = right/down, 3–4 = left/up (see
 * https://lucide.dev/icons/arrow-up-down). Tint strokes so only the active half reads primary.
 */
const ARROW_UP_DOWN_DESC_TINT =
  "[&_path:nth-of-type(1)]:stroke-primary [&_path:nth-of-type(2)]:stroke-primary [&_path:nth-of-type(3)]:stroke-muted-foreground [&_path:nth-of-type(4)]:stroke-muted-foreground";

const ARROW_UP_DOWN_ASC_TINT =
  "[&_path:nth-of-type(1)]:stroke-muted-foreground [&_path:nth-of-type(2)]:stroke-muted-foreground [&_path:nth-of-type(3)]:stroke-primary [&_path:nth-of-type(4)]:stroke-primary";

/** Triple-cycle: desc → asc → reset (to default). Use in onSort handlers. */
export function getNextSortState(
  currentField: string | null,
  currentDir: SortDirection,
  clickedField: string,
  defaultField: string | null,
  defaultDir: SortDirection
): { field: string | null; dir: SortDirection } {
  if (currentField !== clickedField) {
    return { field: clickedField, dir: "desc" };
  }
  if (currentDir === "desc") {
    return { field: clickedField, dir: "asc" };
  }
  return { field: defaultField, dir: defaultDir };
}

interface SortableHeaderProps {
  className?: string;
  field: string;
  label: string;
  onSort: (field: string) => void;
  sortDirection: SortDirection;
  sortField: string | null;
}

export function SortableHeader({
  label,
  field,
  sortField,
  sortDirection,
  onSort,
  className,
}: SortableHeaderProps) {
  const isActive = sortField === field;
  return (
    <button
      className={cn(
        "flex min-h-0 w-fit cursor-pointer select-none items-center whitespace-nowrap border-0 bg-transparent p-0 text-left font-medium text-muted-foreground text-xs leading-none outline-none transition-colors hover:text-text-primary focus-visible:outline-none",
        TABLE_HEADER_CONTROLS_GAP_CLASS,
        className
      )}
      onClick={() => onSort(field)}
      type="button"
    >
      {label}
      <ArrowUpDown
        {...TABLE_HEADER_LUCIDE_STROKE_PROPS}
        aria-hidden
        className={cn(
          TABLE_HEADER_LUCIDE_ICON_CLASS,
          !isActive && "[&_path]:stroke-muted-foreground",
          isActive && sortDirection === "desc" && ARROW_UP_DOWN_DESC_TINT,
          isActive && sortDirection === "asc" && ARROW_UP_DOWN_ASC_TINT
        )}
      />
    </button>
  );
}
