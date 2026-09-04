"use client";

import { captureException } from "@sentry/nextjs";
import { Roboto_Mono } from "next/font/google";
import localFont from "next/font/local";
import { useEffect } from "react";

import "../index.css";

import { ErrorFallback } from "@/ui/error-fallback";

const inter = localFont({
  src: "../fonts/InterVariable.woff2",
  variable: "--font-inter",
  display: "swap",
  fallback: ["system-ui", "-apple-system", "sans-serif"],
  adjustFontFallback: "Arial",
});

/** Opt-in: mirrors root layout so `--font-roboto-mono` exists if styles reference it. */
const robotoMono = Roboto_Mono({
  subsets: ["latin"],
  variable: "--font-roboto-mono",
  display: "swap",
});

/**
 * Root-level error boundary for crashes in the root layout.
 * Must include its own <html> and <body> per Next.js docs; mirror root layout
 * tokens/fonts/CSS so the fallback matches the Doji shell.
 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    captureException(error, {
      tags: {
        section: "ui_error_boundary",
        action: "global_error_boundary",
      },
    });
  }, [error]);

  return (
    <html className="doji" lang="en" suppressHydrationWarning>
      <head>
        <title>Something went wrong · Doji</title>
      </head>
      <body
        className={`${inter.variable} ${robotoMono.variable} flex h-svh min-h-0 flex-col overflow-y-auto overflow-x-visible bg-background text-foreground antialiased`}
      >
        <ErrorFallback
          className="min-h-svh flex-1"
          error={error}
          reset={reset}
          title="Something went wrong"
        />
      </body>
    </html>
  );
}
