"use client";

import type { Column } from "@tanstack/react-table";
import { ChevronDown, ChevronsUpDown, ChevronUp } from "lucide-react";

import { cn } from "@/utils/cn";

interface DataTableColumnHeaderProps<TData, TValue> {
  className?: string;
  column: Column<TData, TValue>;
  title: string;
}

export function DataTableColumnHeader<TData, TValue>({
  column,
  title,
  className,
}: DataTableColumnHeaderProps<TData, TValue>) {
  if (!column.getCanSort()) {
    return <span className={cn(className)}>{title}</span>;
  }

  const sorted = column.getIsSorted();

  return (
    <button
      className={cn(
        "flex cursor-pointer select-none items-center gap-0.5 text-muted-foreground transition-colors hover:text-text-primary",
        className
      )}
      onClick={() => {
        if (sorted === false) {
          column.toggleSorting(true);
        } else if (sorted === "desc") {
          column.toggleSorting(false);
        } else {
          column.clearSorting();
        }
      }}
      type="button"
    >
      {title}
      {sorted === "asc" ? (
        <ChevronUp className="size-3 text-primary" />
      ) : // biome-ignore lint/style/noNestedTernary: readable three-way sort icon selection
      sorted === "desc" ? (
        <ChevronDown className="size-3 text-primary" />
      ) : (
        <ChevronsUpDown className="size-3" />
      )}
    </button>
  );
}
