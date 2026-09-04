import { CircleCheck, CircleX, Info, TriangleAlert } from "lucide-react";
import type { ReactNode } from "react";

import { cn } from "@/lib/cn";

type CalloutType = "info" | "warning" | "warn" | "error" | "success" | "tip";

type ResolvedType = "info" | "warning" | "error" | "success";

const config: Record<
  ResolvedType,
  { icon: typeof Info; bg: string; iconClass: string; border: string }
> = {
  info: {
    icon: Info,
    bg: "bg-doji-green/8",
    iconClass: "text-doji-green",
    border: "border-doji-green/20",
  },
  warning: {
    icon: TriangleAlert,
    bg: "bg-yellow-400/8",
    iconClass: "text-yellow-400",
    border: "border-yellow-400/20",
  },
  error: {
    icon: CircleX,
    bg: "bg-red-400/8",
    iconClass: "text-red-400",
    border: "border-red-400/20",
  },
  success: {
    icon: CircleCheck,
    bg: "bg-green-400/8",
    iconClass: "text-green-400",
    border: "border-green-400/20",
  },
};

interface CalloutProps {
  children: ReactNode;
  className?: string;
  title?: string;
  type?: CalloutType;
}

function resolveType(type: CalloutType): ResolvedType {
  if (type === "warn") {
    return "warning";
  }
  if (type === "tip") {
    return "info";
  }
  if (type === "error" || type === "success" || type === "warning") {
    return type;
  }
  return "info";
}

export function Callout({
  type = "info",
  title,
  children,
  className,
}: CalloutProps) {
  const resolved = resolveType(type);
  const { icon: Icon, bg, iconClass, border } = config[resolved];

  return (
    <div
      className={cn(
        "not-prose my-4 flex overflow-hidden rounded-xl border bg-fd-card",
        border,
        className
      )}
    >
      {/* Icon panel */}
      <div className={cn("flex items-center justify-center px-4", bg)}>
        <Icon className={cn("size-4 shrink-0", iconClass)} />
      </div>

      {/* Content */}
      <div className="min-w-0 flex-1 px-4 py-3 text-sm">
        {title && <p className="mb-1 font-medium text-text-primary">{title}</p>}
        <div className="text-text-secondary [&_a]:font-medium [&_a]:text-doji-green [&_blockquote]:m-0 [&_blockquote]:border-none [&_blockquote]:p-0 [&_blockquote]:not-italic">
          {children}
        </div>
      </div>
    </div>
  );
}
