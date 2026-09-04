"use client";

import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";
import { STALE_DEFAULT } from "@/config/query";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/ui/tooltip";
import { cn } from "@/utils/cn";

const STATUS_PAGE_URL = "https://status.doji.bet";
const STATUS_JSON_URL = "/api/status";

/** Poll interval - aligns with status page CDN revalidation without hammering the API. */
const POLL_MS = 45_000;

interface ParsedStatus {
  aggregateState: string | null;
  /** Worst-case availability across monitors (0-1), from `included` resources. */
  minAvailability: number | null;
}

function parseMinAvailability(json: unknown): number | null {
  if (!json || typeof json !== "object") {
    return null;
  }
  const root = json as { included?: unknown };
  if (!Array.isArray(root.included)) {
    return null;
  }
  const values: number[] = [];
  for (const item of root.included) {
    if (!item || typeof item !== "object") {
      continue;
    }
    const o = item as {
      type?: string;
      attributes?: { availability?: unknown };
    };
    if (
      o.type === "status_page_resource" &&
      typeof o.attributes?.availability === "number" &&
      Number.isFinite(o.attributes.availability)
    ) {
      values.push(o.attributes.availability);
    }
  }
  if (values.length === 0) {
    return null;
  }
  return Math.min(...values);
}

function parseStatusJson(json: unknown): ParsedStatus {
  if (!json || typeof json !== "object") {
    return { aggregateState: null, minAvailability: null };
  }
  const root = json as {
    data?: { attributes?: { aggregate_state?: unknown } };
  };
  const raw = root.data?.attributes?.aggregate_state;
  const aggregateState = typeof raw === "string" ? raw : null;
  return {
    aggregateState,
    minAvailability: parseMinAvailability(json),
  };
}

function statusDotClass(
  aggregateState: string | null,
  isPending: boolean
): string {
  if (isPending) {
    return "bg-muted-foreground/50 animate-pulse";
  }
  if (aggregateState == null) {
    return "bg-muted-foreground/40";
  }
  if (aggregateState.toLowerCase() === "operational") {
    return "bg-primary animate-pulse";
  }
  return "bg-destructive";
}

/** Short label for the bottom bar: Stable when all good; % when degraded; else concise words. */
function bottomBarStatusLabel(
  aggregateState: string | null,
  minAvailability: number | null,
  isLoading: boolean
): string {
  if (aggregateState === null) {
    return isLoading ? "Status" : "—";
  }
  const s = aggregateState.toLowerCase();
  if (s === "operational") {
    return "Stable";
  }
  if (s.includes("maintenance")) {
    return "Maintenance";
  }
  if (s.includes("downtime") || s.includes("outage") || s === "major_outage") {
    return "Down";
  }
  if (s.includes("degraded") || s.includes("partial")) {
    if (minAvailability != null && minAvailability > 0 && minAvailability < 1) {
      const pct = Math.round(minAvailability * 1000) / 10;
      return `${pct}%`;
    }
    return s.includes("partial") ? "Partial" : "Degraded";
  }
  return aggregateState.replace(/_/g, " ");
}

/**
 * Live aggregate from Better Stack (`/index.json`): Stable when operational;
 * otherwise concise label (%, Down, Maintenance, …).
 */
export function BottomBarStatusLink() {
  const { data, isPending, isError } = useQuery({
    queryKey: ["betterstack-status", STATUS_JSON_URL],
    queryFn: async () => {
      const res = await fetch(STATUS_JSON_URL, { cache: "no-store" });
      if (!res.ok) {
        throw new Error(`status ${res.status}`);
      }
      return res.json() as unknown;
    },
    refetchInterval: POLL_MS,
    staleTime: STALE_DEFAULT,
    retry: 1,
  });

  const status = useMemo((): ParsedStatus => {
    if (isError || data == null) {
      return { aggregateState: null, minAvailability: null };
    }
    return parseStatusJson(data);
  }, [data, isError]);

  const { aggregateState, minAvailability } = status;
  const dotClass = statusDotClass(aggregateState, isPending);
  const label = bottomBarStatusLabel(
    aggregateState,
    minAvailability,
    isPending
  );

  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <a
            aria-label={`${label} - opens status page in a new tab`}
            className="inline-flex shrink-0 select-none items-center gap-1.5 rounded-md border-0 bg-transparent px-2 py-1 font-medium text-muted-foreground text-xs uppercase tracking-wide shadow-none transition-colors hover:text-foreground"
            href={STATUS_PAGE_URL}
            rel="noopener noreferrer"
            target="_blank"
          >
            <span
              aria-hidden
              className={cn("h-2 w-2 shrink-0 rounded-full", dotClass)}
            />
            <span>{label}</span>
          </a>
        }
      />
      <TooltipContent>
        {aggregateState
          ? `Status: ${aggregateState.replace(/_/g, " ")}`
          : "Service status"}
      </TooltipContent>
    </Tooltip>
  );
}
