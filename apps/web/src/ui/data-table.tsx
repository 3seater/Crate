"use client";

import type {
  ColumnDef,
  ColumnFiltersState,
  SortingState,
  VisibilityState,
} from "@tanstack/react-table";
import {
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  useReactTable,
} from "@tanstack/react-table";
import * as React from "react";

import { Input } from "@/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/ui/table";
import { cn } from "@/utils/cn";

import { DataTablePagination } from "./data-table-pagination";
import { DataTableViewOptions } from "./data-table-view-options";

export interface DataTableProps<TData, TValue> {
  /** Body row base className (e.g. border-border/50 border-b). Merged with rowClassName. */
  bodyRowClassName?: string;
  /** TableCell base className (merged with column meta). */
  cellClassName?: string;
  /** Wrapper className. */
  className?: string;
  columns: ColumnDef<TData, TValue>[];
  data: TData[];
  /** Default page size. */
  defaultPageSize?: number;
  /** Disable pagination (show all rows). Use with parent-driven infinite scroll. */
  disablePagination?: boolean;
  /** Empty state when no data. */
  emptyMessage?: React.ReactNode;
  /** Filter column ID (e.g. "question" for search). Enables filter input when set. */
  filterColumnId?: string;
  /** Placeholder for the filter input. */
  filterPlaceholder?: string;
  /** Get row ID for stable keys. */
  getRowId?: (row: TData, index: number) => string;
  /** TableHead cell className override. */
  headerCellClassName?: string;
  /** Header row className (e.g. border-border border-b). */
  headerRowClassName?: string;
  /** Page size options. */
  pageSizeOptions?: number[];
  /** Row className (e.g. hover:bg-market-list-hover). */
  rowClassName?: string;
  /** Table wrapper className (border, etc.). */
  tableClassName?: string;
  /** Custom toolbar content (search, etc.) - if not provided and filterColumnId is set, shows default search. */
  toolbar?: React.ReactNode;
}

export function DataTable<TData, TValue>({
  columns,
  data,
  filterColumnId,
  filterPlaceholder = "Filter...",
  toolbar,
  getRowId,
  pageSizeOptions = [10, 25, 50, 100],
  defaultPageSize = 25,
  disablePagination = false,
  className,
  tableClassName,
  emptyMessage = "No results.",
  rowClassName,
  headerRowClassName,
  bodyRowClassName,
  headerCellClassName,
  cellClassName,
}: DataTableProps<TData, TValue>) {
  "use no memo";
  const [sorting, setSorting] = React.useState<SortingState>([]);
  const [columnFilters, setColumnFilters] = React.useState<ColumnFiltersState>(
    []
  );
  const [columnVisibility, setColumnVisibility] =
    React.useState<VisibilityState>({});
  const [rowSelection, setRowSelection] = React.useState({});

  const table = useReactTable({
    data,
    columns,
    state: {
      sorting,
      columnFilters,
      columnVisibility,
      rowSelection,
    },
    onSortingChange: (updater) =>
      React.startTransition(() => setSorting(updater)),
    onColumnFiltersChange: setColumnFilters,
    onColumnVisibilityChange: setColumnVisibility,
    onRowSelectionChange: setRowSelection,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    ...(disablePagination
      ? {}
      : { getPaginationRowModel: getPaginationRowModel() }),
    getRowId,
    initialState: {
      pagination: {
        pageSize: disablePagination ? Number.MAX_SAFE_INTEGER : defaultPageSize,
      },
    },
  });

  const filterColumn = filterColumnId
    ? table.getColumn(filterColumnId)
    : undefined;
  const hasToolbarContent = filterColumn || toolbar;

  return (
    <div className={cn("flex flex-col gap-4", className)}>
      {hasToolbarContent && (
        <div className="flex flex-wrap items-center gap-3">
          {filterColumn && (
            <Input
              aria-label={filterPlaceholder}
              className="h-8 max-w-xs"
              onChange={(e) => filterColumn.setFilterValue(e.target.value)}
              placeholder={filterPlaceholder}
              value={(filterColumn.getFilterValue() as string) ?? ""}
            />
          )}
          {toolbar}
          <DataTableViewOptions table={table} />
        </div>
      )}
      <div
        className={cn(
          "overflow-x-auto rounded-none border border-border-subtle bg-surface-1",
          tableClassName
        )}
      >
        <Table>
          <TableHeader>
            {table.getHeaderGroups().map((headerGroup) => (
              <TableRow
                className={
                  headerRowClassName ??
                  "border-border bg-surface-2 hover:bg-transparent"
                }
                key={headerGroup.id}
              >
                {headerGroup.headers.map((header) => (
                  <TableHead
                    className={cn(
                      headerCellClassName ?? "text-text-secondary",
                      (
                        header.column.columnDef.meta as {
                          headerClassName?: string;
                        }
                      )?.headerClassName
                    )}
                    key={header.id}
                  >
                    {header.isPlaceholder
                      ? null
                      : flexRender(
                          header.column.columnDef.header,
                          header.getContext()
                        )}
                  </TableHead>
                ))}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {table.getRowModel().rows?.length ? (
              table.getRowModel().rows.map((row) => (
                <TableRow
                  className={cn(
                    bodyRowClassName ?? "border-border transition-colors",
                    rowClassName ?? "hover:bg-market-list-hover"
                  )}
                  data-state={row.getIsSelected() ? "selected" : undefined}
                  key={row.id}
                >
                  {row.getVisibleCells().map((cell) => {
                    const meta = cell.column.columnDef.meta as
                      | { className?: string }
                      | undefined;
                    return (
                      <TableCell
                        className={cn(cellClassName ?? "py-3", meta?.className)}
                        key={cell.id}
                      >
                        {flexRender(
                          cell.column.columnDef.cell,
                          cell.getContext()
                        )}
                      </TableCell>
                    );
                  })}
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell
                  className="h-24 text-center text-muted-foreground"
                  colSpan={columns.length}
                >
                  {emptyMessage}
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
      {!disablePagination && (
        <DataTablePagination pageSizeOptions={pageSizeOptions} table={table} />
      )}
    </div>
  );
}
