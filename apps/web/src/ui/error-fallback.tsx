"use client";

import { logger } from "@doji/logger/client";
import { useCallback, useEffect } from "react";
import { stripDevErrorQueryFromCurrentLocation } from "@/lib/dev/dev-error-boundary-test";
import { getTrpcDisplayMessage } from "@/lib/trpc/errors";
import { Button } from "@/ui/button";
import { FullPageStatus } from "@/ui/full-page-status";
import { cn } from "@/utils/cn";

export interface ErrorFallbackProps {
  /** Extra classes on the outer status container (e.g. `global-error` full viewport). */
  className?: string;
  /** Error from error boundary (may have digest in production). */
  error: Error & { digest?: string };
  /** Optional override for the message (otherwise uses getTrpcDisplayMessage). */
  messageOverride?: string;
  /** Reset function from error boundary. */
  reset: () => void;
  /** Short title shown above the message (e.g. "Failed to load market"). */
  title: string;
}

/**
 * Shared error boundary fallback UI.
 * Logs error (and digest) in useEffect; uses getTrpcDisplayMessage for user-facing text.
 */
export function ErrorFallback({
  title,
  error,
  reset,
  messageOverride,
  className,
}: ErrorFallbackProps) {
  const message = messageOverride ?? getTrpcDisplayMessage(error);

  useEffect(() => {
    logger.error(
      { title, message: error.message, digest: error.digest },
      "Error boundary caught"
    );
  }, [error, title]);

  const handleRetry = useCallback(() => {
    const withoutDevThrow = stripDevErrorQueryFromCurrentLocation();
    if (withoutDevThrow !== null) {
      window.location.assign(withoutDevThrow);
      return;
    }
    reset();
  }, [reset]);

  return (
    <FullPageStatus
      className={cn(className)}
      description={message}
      kicker="!"
      role="alert"
      title={title}
    >
      <Button
        onClick={handleRetry}
        size="default"
        type="button"
        variant="default"
      >
        Try again
      </Button>
    </FullPageStatus>
  );
}
