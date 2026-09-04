import * as Sentry from "@sentry/nextjs";

// https://nextjs.org/docs/app/api-reference/file-conventions/instrumentation
// https://github.com/lit/lit/issues/4877
type GlobalWithLitWarnings = typeof globalThis & {
  litIssuedWarnings?: Set<string>;
};

export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    await import("./sentry.server.config");
  }

  if (process.env.NEXT_RUNTIME === "edge") {
    await import("./sentry.edge.config");
  }

  if (process.env.NODE_ENV !== "production") {
    const g = globalThis as GlobalWithLitWarnings;
    g.litIssuedWarnings ??= new Set<string>();
    g.litIssuedWarnings.add(
      "Lit is in dev mode. Not recommended for production! See https://lit.dev/msg/dev-mode for more information."
    );
  }
}

export const onRequestError = Sentry.captureRequestError;
