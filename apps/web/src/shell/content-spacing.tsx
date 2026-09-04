import { cva, type VariantProps } from "class-variance-authority";
import type { ComponentProps } from "react";
import { cn } from "@/utils/cn";

const contentSpacingVariants = cva("flex min-w-0 flex-col", {
  variants: {
    variant: {
      default: "gap-4 py-4",
      tight: "gap-2 py-2",
      relaxed: "gap-4 py-6",
      spacious: "gap-6 py-6",
    },
  },
  defaultVariants: {
    variant: "default",
  },
});

export type ContentSpacingProps = ComponentProps<"div"> &
  VariantProps<typeof contentSpacingVariants>;

/**
 * Content spacing: consistent vertical rhythm and flex for page content.
 * Used inside content-width wrapper. Aligned with new-ui: relaxed = px-6 py-6 feel.
 */
export function ContentSpacing({
  variant,
  className,
  ...props
}: ContentSpacingProps) {
  return (
    <div
      className={cn(contentSpacingVariants({ variant }), className)}
      {...props}
    />
  );
}
