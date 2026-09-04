"use client";

import { Search, X } from "lucide-react";
import * as React from "react";
import { cn } from "@/utils/cn";

/**
 * Shared search bar styling — matches main header search.
 * No green focus ring; consistent text-sm font size.
 * Optional clear button (X) inside on the right when showClear + onClear provided.
 */
const SearchBar = React.forwardRef<
  HTMLInputElement,
  React.ComponentProps<"input"> & {
    containerClassName?: string;
    /** When true and onClear provided, shows X button inside search bar on the right */
    showClear?: boolean;
    onClear?: () => void;
  }
>(
  (
    {
      className,
      containerClassName,
      placeholder = "Search...",
      type = "text",
      showClear,
      onClear,
      ...props
    },
    ref
  ) => {
    return (
      <div
        className={cn(
          "flex h-10 min-w-0 items-center gap-2 rounded-md border border-border bg-transparent px-3 transition-[color,border-color] focus-within:border-primary/60 not-focus-within:hover:border-border-strong",
          containerClassName
        )}
      >
        <Search
          aria-hidden
          className="h-3.5 w-3.5 shrink-0 text-muted-foreground"
        />
        <input
          className={cn(
            "min-w-0 flex-1 bg-transparent text-foreground text-sm! outline-none placeholder:text-muted-foreground focus:outline-none",
            className
          )}
          placeholder={placeholder}
          ref={ref}
          type={type}
          {...props}
        />
        {onClear ? (
          // biome-ignore lint/style/noNestedTernary: readable clear button / spacer / null three-way
          showClear ? (
            <button
              aria-label="Clear"
              className="shrink-0 rounded p-0.5 text-muted-foreground transition-colors hover:text-foreground"
              onClick={onClear}
              type="button"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          ) : (
            <span aria-hidden className="size-6 shrink-0" />
          )
        ) : null}
      </div>
    );
  }
);
SearchBar.displayName = "SearchBar";

export { SearchBar };
