"use client";

import type { Table } from "@tanstack/react-table";
import { ChevronLeftIcon, ChevronRightIcon } from "lucide-react";

import { Button } from "@/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/ui/select";
import { cn } from "@/utils/cn";

interface DataTablePaginationProps<TData> {
  className?: string;
  pageSizeOptions?: number[];
  table: Table<TData>;
}

const DEFAULT_PAGE_SIZES = [10, 25, 50, 100];

export function DataTablePagination<TData>({
  table,
  className,
  pageSizeOptions = DEFAULT_PAGE_SIZES,
}: DataTablePaginationProps<TData>) {
  const pageCount = table.getPageCount();
  const totalRows = table.getFilteredRowModel().rows.length;

  if (totalRows === 0) {
    return null;
  }

  return (
    <div
      className={cn(
        "flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between",
        className
      )}
    >
      <div className="flex items-center gap-4">
        <p className="text-muted-foreground text-sm">
          {table.getFilteredSelectedRowModel().rows.length > 0
            ? `${table.getFilteredSelectedRowModel().rows.length} of ${totalRows} row(s) selected`
            : `${totalRows} row(s)`}
        </p>
        {pageCount > 1 && (
          <div className="flex items-center gap-2">
            <span className="text-muted-foreground text-sm">Rows per page</span>
            <Select
              onValueChange={(value) => table.setPageSize(Number(value))}
              value={String(table.getState().pagination.pageSize)}
            >
              <SelectTrigger aria-label="Rows per page" className="h-8 w-20">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {pageSizeOptions.map((size) => (
                  <SelectItem key={size} value={String(size)}>
                    {size}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}
      </div>
      {pageCount > 1 && (
        <div className="flex items-center gap-2">
          <span className="text-muted-foreground text-sm">
            Page {table.getState().pagination.pageIndex + 1} of {pageCount}
          </span>
          <div className="flex gap-0.5">
            <Button
              aria-label="Previous page"
              disabled={!table.getCanPreviousPage()}
              onClick={() => table.previousPage()}
              size="icon-sm"
              variant="outline"
            >
              <ChevronLeftIcon />
            </Button>
            <Button
              aria-label="Next page"
              disabled={!table.getCanNextPage()}
              onClick={() => table.nextPage()}
              size="icon-sm"
              variant="outline"
            >
              <ChevronRightIcon />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
