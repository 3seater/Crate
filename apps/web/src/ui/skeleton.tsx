import type { ComponentProps } from "react";
import { cn } from "@/utils/cn";

type SkeletonProps = ComponentProps<"div"> & {
  /**
   * Dense table / list placeholders: `rounded-sm` (default skeleton uses
   * `rounded-md`). Pass `rounded-md` in `className` for avatars, thumbs, and
   * control-sized blocks where the real UI uses the larger radius.
   */
  tableRow?: boolean;
};

function Skeleton({ className, tableRow, ...props }: SkeletonProps) {
  return (
    <div
      className={cn(
        "bg-muted",
        tableRow ? "rounded-sm" : "rounded-md",
        // After defaults so callers can override radius (e.g. `rounded-md` avatars, `rounded-lg` cards).
        className
      )}
      data-slot="skeleton"
      {...props}
    />
  );
}

export type { SkeletonProps };
export { Skeleton };
