"use client";

import { Globe } from "lucide-react";
import { HoverCard, HoverCardContent, HoverCardTrigger } from "@/ui/hover-card";
import { RestrictedRegionContent } from "@/ui/restricted-region-content";
import { cn } from "@/utils/cn";

/**
 * Non-interactive button-style element shown when the user is geo-blocked.
 * Replaces Buy/Sell/Deposit-style buttons; not clickable.
 * Shows a hover tooltip with region info and link to available regions.
 * Uses design tokens: surface-2, text-muted for greyed-out appearance.
 */
export function RestrictedRegionButton({
  className,
  size = "default",
}: {
  className?: string;
  size?: "sm" | "default" | "lg";
}) {
  const sizeClasses = {
    sm: "h-6 gap-1.5 px-3 py-1.5 text-xs [&_svg]:size-3",
    default: "h-7 gap-2 px-4 py-2 text-sm [&_svg]:size-4",
    lg: "h-8 gap-2 px-5 py-3 text-sm [&_svg]:size-4",
  };

  return (
    <HoverCard>
      <HoverCardTrigger>
        <div
          aria-disabled="true"
          aria-label="Trading not available in your region"
          className={cn(
            "inline-flex cursor-default select-none items-center justify-center rounded-md border border-border bg-surface-2 font-medium font-sans text-text-muted [&_svg]:shrink-0",
            sizeClasses[size],
            className
          )}
          role="presentation"
        >
          <Globe className="size-4" />
          <span>Restricted region</span>
        </div>
      </HoverCardTrigger>
      <HoverCardContent
        align="center"
        className="flex w-auto max-w-70 flex-col items-center border border-border bg-card px-3 py-2.5 text-center text-text-primary shadow-md"
        side="top"
        sideOffset={8}
      >
        <RestrictedRegionContent />
      </HoverCardContent>
    </HoverCard>
  );
}
