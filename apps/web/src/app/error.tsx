"use client";

import { captureException } from "@sentry/nextjs";
import { useEffect } from "react";

import { ErrorFallback } from "@/ui/error-fallback";

export default function RootError({
  error,
  reset,
}: {
  error: globalThis.Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    captureException(error, {
      tags: {
        section: "ui_error_boundary",
        action: "app_error_boundary",
      },
    });
  }, [error]);

  return (
    <ErrorFallback error={error} reset={reset} title="Something went wrong" />
  );
}
