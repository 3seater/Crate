import { Button } from "@/ui/button";
import { cn } from "@/utils/cn";

interface InlineQueryErrorProps {
  className?: string;
  /** `compact` = tighter padding for popovers / narrow panels. */
  density?: "default" | "compact";
  /** Optional detail line (muted). */
  description?: string;
  onRetry: () => void;
  /** Short heading (e.g. "Failed to load positions"). */
  title: string;
}

/**
 * Consistent inline error + retry for tables, widgets, and route sections.
 * Prefer this over ad-hoc divs so copy, color, and Retry match across the app.
 */
export function InlineQueryError({
  title,
  description,
  onRetry,
  density = "default",
  className,
}: InlineQueryErrorProps) {
  return (
    <div
      className={cn(
        "flex min-h-full flex-col items-center justify-center gap-2 text-center",
        density === "compact" ? "py-6" : "py-8",
        className
      )}
    >
      <div className="flex max-w-sm flex-col items-center gap-1">
        <span
          className={cn(
            "font-sans text-sell",
            density === "compact" ? "text-xs" : "text-sm"
          )}
        >
          {title}
        </span>
        {description ? (
          <span className="text-text-secondary text-xs">{description}</span>
        ) : null}
      </div>
      <Button
        className={cn(
          "font-sans text-text-tertiary underline hover:text-text-secondary",
          density === "compact" ? "text-xs" : "text-sm"
        )}
        onClick={onRetry}
        type="button"
        variant="link"
      >
        Retry
      </Button>
    </div>
  );
}
