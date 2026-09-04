"use client";

import { useSearchParams } from "next/navigation";
import { Suspense } from "react";

import {
  DEV_ERROR_QUERY_PARAM,
  isDevErrorBoundaryTestEnabled,
} from "@/lib/dev/dev-error-boundary-test";

/**
 * Development-only: throws during **client** render when
 * `?__throw=client` is present, so you can test the same route’s client tree.
 * Wrap in `<Suspense>` is handled by this export.
 */
function DevErrorThrowClientInner() {
  const searchParams = useSearchParams();
  if (!isDevErrorBoundaryTestEnabled()) {
    return null;
  }
  const raw = searchParams.get(DEV_ERROR_QUERY_PARAM)?.toLowerCase();
  if (raw !== "client") {
    return null;
  }
  throw new Error(
    "[dev] Intentional client error boundary test — remove ?__throw=client from the URL"
  );
}

export function DevErrorThrowClient() {
  return (
    <Suspense fallback={null}>
      <DevErrorThrowClientInner />
    </Suspense>
  );
}
