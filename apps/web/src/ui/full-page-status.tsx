import type { ReactNode } from "react";

import { cn } from "@/utils/cn";

interface FullPageStatusProps {
  children?: ReactNode;
  className?: string;
  description?: string | null;
  /** Large display line (e.g. `404`, `!`) — decorative; `aria-hidden` on the wrapper. */
  kicker: ReactNode;
  /** `alert` for runtime errors; default `status` for informational pages like 404. */
  role?: "alert" | "status";
  title: string;
}

/**
 * Centered full-area status layout shared by `not-found`, `ErrorFallback`, and `global-error`.
 * Matches the explore shell: display kicker + `text-lg` heading + `text-sm` body.
 */
export function FullPageStatus({
  kicker,
  title,
  description,
  role = "status",
  className,
  children,
}: FullPageStatusProps) {
  return (
    <div
      className={cn(
        "flex min-h-0 flex-1 flex-col items-center justify-center gap-6 p-8 text-center",
        className
      )}
      role={role === "status" ? "status" : "alert"}
    >
      <div className="flex flex-col items-center gap-3">
        <span
          aria-hidden
          className="font-medium text-[120px] text-text-tertiary leading-none tracking-tight"
        >
          {kicker}
        </span>
        <h1 className="font-medium text-lg text-text-primary">{title}</h1>
        {description ? (
          <p className="max-w-sm text-balance text-sm text-text-secondary">
            {description}
          </p>
        ) : null}
      </div>
      {children}
    </div>
  );
}
