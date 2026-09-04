import "client-only";
import type { AppRouter } from "@doji/contract";
import { env } from "@doji/env/web";
import { logger } from "@doji/logger/client";
import { addBreadcrumb, captureMessage, metrics } from "@sentry/nextjs";
import { QueryCache, QueryClient } from "@tanstack/react-query";
import {
  createTRPCClient,
  httpBatchStreamLink,
  loggerLink,
  type TRPCLink,
} from "@trpc/client";
import type { AnyRouter } from "@trpc/server";
import { map, observable } from "@trpc/server/observable";
import { createTRPCOptionsProxy } from "@trpc/tanstack-react-query";
import { STALE_DEFAULT } from "@/config/query";
import { toast } from "@/lib/app-toast";
import { getSessionToken } from "@/lib/session-manager";
import {
  getTrpcDisplayDetails,
  getTrpcDisplayMessage,
  getTrpcProcedurePathFromQueryKey,
  isInputValidationError,
  TRPC_QUERY_FULLY_SILENT_PATHS,
  TRPC_QUERY_SILENT_NOT_FOUND_PATHS,
} from "@/lib/trpc/errors";

/** Subset of TanStack `Query` used by `QueryCache.onError` (avoids TError generic mismatch). */
interface TrpcQueryCacheEntry {
  queryKey?: readonly unknown[];
}

function trpcErrorCode(error: unknown): string | undefined {
  if (!error || typeof error !== "object" || !("data" in error)) {
    return;
  }
  return (error as { data?: { code?: string } }).data?.code;
}

function handleSilentTrpcQueryError(
  code: string | undefined,
  query: TrpcQueryCacheEntry | undefined
): boolean {
  if (code === "PRECONDITION_FAILED") {
    metrics.count("trpc_query_errors", 1, {
      attributes: { code, category: "precondition_failed" },
    });
    return true;
  }
  if (query?.queryKey != null) {
    const path = getTrpcProcedurePathFromQueryKey(query.queryKey);
    if (path != null && TRPC_QUERY_FULLY_SILENT_PATHS.has(path)) {
      return true;
    }
    if (
      code === "NOT_FOUND" &&
      path != null &&
      TRPC_QUERY_SILENT_NOT_FOUND_PATHS.has(path)
    ) {
      return true;
    }
  }
  return false;
}

function emitTrpcServerFailureSignals(
  code: string | undefined,
  procedurePath: string
): void {
  if (
    code !== "INTERNAL_SERVER_ERROR" &&
    code !== "SERVICE_UNAVAILABLE" &&
    code !== "CIRCUIT_OPEN"
  ) {
    return;
  }
  addBreadcrumb({
    category: "trpc.query",
    message: `tRPC ${code}`,
    level: "error",
    data: { path: procedurePath, code },
  });
  if (Math.random() < 0.05) {
    captureMessage(`tRPC query failed (${code})`, {
      level: "error",
      tags: {
        code: code ?? "UNKNOWN",
        path: procedurePath,
      },
    });
  }
}

function trpcQueryRetryToastAction(
  client: QueryClient,
  code: string | undefined,
  queryKey: unknown
):
  | {
      label: "retry";
      onClick: () => void;
    }
  | undefined {
  const skipRetry =
    code === "INTERNAL_SERVER_ERROR" ||
    code === "CIRCUIT_OPEN" ||
    code === "SERVICE_UNAVAILABLE";
  if (
    skipRetry ||
    queryKey == null ||
    !Array.isArray(queryKey) ||
    queryKey.length === 0
  ) {
    return;
  }
  return {
    label: "retry" as const,
    onClick: () => {
      try {
        client.invalidateQueries({ queryKey });
      } catch {
        // Guard against internal TanStack Query errors when query is disposed
      }
    },
  };
}

function handleTrpcQueryCacheError(
  client: QueryClient,
  error: unknown,
  query: TrpcQueryCacheEntry | undefined
): void {
  if (isInputValidationError(error)) {
    return;
  }
  const code = trpcErrorCode(error);
  // Skip non-tRPC errors (e.g. client-side CLOB queries that reject during init)
  if (!code && error instanceof Error && !("shape" in error)) {
    return;
  }
  if (handleSilentTrpcQueryError(code, query)) {
    return;
  }
  const message = getTrpcDisplayMessage(error);
  const details = getTrpcDisplayDetails(error);
  const procedurePath =
    query?.queryKey == null
      ? "unknown"
      : (getTrpcProcedurePathFromQueryKey(query.queryKey) ?? "unknown");

  metrics.count("trpc_query_errors", 1, {
    attributes: {
      code: code ?? "UNKNOWN",
      path: procedurePath,
    },
  });

  emitTrpcServerFailureSignals(code, procedurePath);

  const retry = trpcQueryRetryToastAction(client, code, query?.queryKey);
  toast.error(message, {
    id: message,
    description: details?.fix ?? details?.why,
    ...(retry && { action: retry }),
  });
}

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: STALE_DEFAULT,
      gcTime: 300_000,
      retry: (failureCount, error) => {
        const code =
          error && typeof error === "object" && "data" in error
            ? (error as { data?: { code?: string } }).data?.code
            : undefined;
        // Don't retry errors that won't resolve without user action or server recovery
        if (
          code === "UNAUTHORIZED" ||
          code === "FORBIDDEN" ||
          code === "NOT_FOUND" ||
          code === "INTERNAL_SERVER_ERROR"
        ) {
          return false;
        }
        return failureCount < 2;
      },
    },
  },
  queryCache: new QueryCache({
    onError: (error, query) => {
      handleTrpcQueryCacheError(queryClient, error, query);
    },
  }),
});

const MAX_ARRAY_PREVIEW = 3;

/**
 * Strip HTTP meta (Response, responseJSON) from result for consumer.
 * Replaces with serializable { status, statusText } to avoid [object Response] in React Query.
 * Serializes Error objects to { message, name } so the actual message is visible.
 * Does NOT modify result.data — that must reach the consumer unchanged.
 */
function sanitizeForPipeline<T>(result: T): T {
  if (!result || typeof result !== "object") {
    return result;
  }

  // Serialize Error so logger shows message instead of [object Error]
  if (result instanceof Error) {
    return { message: result.message, name: result.name } as T;
  }

  let out = result as Record<string, unknown>;

  // Sanitize HTTP context only (do not touch result.data — it goes to useQuery)
  if ("context" in result) {
    const ctx = (
      result as { context?: { response?: Response; responseJSON?: unknown } }
    ).context;
    if (ctx?.response != null || ctx?.responseJSON !== undefined) {
      out = {
        ...out,
        context: {
          status: ctx.response?.status,
          statusText: ctx.response?.statusText,
        },
      };
    }
  }

  return out as T;
}

/** Sanitize tRPC success envelope for log display (preview large arrays). */
function sanitizeEnvelopeForLog(
  envelope: Record<string, unknown>
): Record<string, unknown> {
  const inner = envelope.result;
  if (
    !inner ||
    typeof inner !== "object" ||
    !Array.isArray((inner as Record<string, unknown>).data)
  ) {
    return envelope;
  }
  const data = (inner as Record<string, unknown>).data as unknown[];
  const preview =
    data.length <= MAX_ARRAY_PREVIEW ? data : `[${data.length} items]`;
  return {
    ...envelope,
    result: { ...(inner as Record<string, unknown>), data: preview },
  };
}

/**
 * Create a display-safe copy for logging. Previews large arrays as "[N items]".
 * Used only in logger callback — does not mutate the pipeline result.
 * Handles tRPC envelope shape: { result: { result: { data, type } } } (outer from logger, inner from envelope).
 * Nested Error objects are converted to { message, name } to avoid "[object Error]" in logs.
 */
function sanitizeForLogDisplay<T>(result: T): T {
  if (!result || typeof result !== "object") {
    return result;
  }
  if (result instanceof Error) {
    return { message: result.message, name: result.name } as T;
  }
  const out = { ...result } as Record<string, unknown>;
  if ("result" in out && out.result !== undefined) {
    if (out.result instanceof Error) {
      out.result = { message: out.result.message, name: out.result.name };
    } else if (typeof out.result === "object" && out.result !== null) {
      out.result = sanitizeEnvelopeForLog(
        out.result as Record<string, unknown>
      );
    }
  }
  return out as T;
}

const isClientDev =
  typeof window !== "undefined" && process.env.NODE_ENV === "development";

function getTrpcOpPath(op: { path?: unknown }): string {
  const p = op.path;
  if (p == null) {
    return "";
  }
  if (Array.isArray(p)) {
    return p.join(".");
  }
  return String(p);
}

function handleUnauthorizedError(op: { path?: unknown }, err: unknown): void {
  const code =
    err && typeof err === "object" && "data" in err
      ? (err as { data?: { code?: string } }).data?.code
      : undefined;
  if (code === "UNAUTHORIZED") {
    const path = getTrpcOpPath(op);
    metrics.count("trpc_unauthorized_errors", 1, {
      attributes: { path },
    });
    logger.info("[trpc] UNAUTHORIZED — skipping full session clear", {
      path,
    });
  }
}

/** Link that sanitizes HTTP result context for consumer (avoids [object Response] in React Query). */
function sanitizeResultLink<TRouter extends AnyRouter>(): TRPCLink<TRouter> {
  return () =>
    ({ next, op }) =>
      next(op).pipe(
        map((result) =>
          result && typeof result === "object"
            ? sanitizeForPipeline(result)
            : result
        )
      );
}

/** tRPC client: setup follows tRPC TanStack React Query "3c – without React context" (singleton client + queryClient, no TRPCProvider). */
function clearSessionOnUnauthorizedLink<
  TRouter extends AnyRouter,
>(): TRPCLink<TRouter> {
  return () =>
    ({ next, op }) =>
      observable((observer) => {
        const sub = next(op).subscribe({
          next: (v) => observer.next?.(v),
          complete: () => observer.complete?.(),
          error: (err) => {
            handleUnauthorizedError(op, err);
            observer.error?.(err);
          },
        });
        return () => sub.unsubscribe();
      });
}

/** tRPC client: setup follows tRPC TanStack React Query "3c – without React context" (singleton client + queryClient, no TRPCProvider). */
const trpcClient = createTRPCClient<AppRouter>({
  links: [
    clearSessionOnUnauthorizedLink(),
    loggerLink({
      console: {
        log: (...args: unknown[]) =>
          logger.info(
            ...args.map((a) =>
              a && typeof a === "object" ? sanitizeForLogDisplay(a) : a
            )
          ),
        // Use warn for tRPC errors: expected failures (geo block, validation, auth)
        // log to console but avoid red error styling that suggests a code bug.
        error: (...args: unknown[]) =>
          logger.warn(
            ...args.map((a) =>
              a && typeof a === "object" ? sanitizeForLogDisplay(a) : a
            )
          ),
      },
      enabled: (opts) => {
        // Dev: log all. Prod: only errors (logger is no-op).
        if (isClientDev) {
          return true;
        }
        const isDownWithError =
          opts.direction === "down" &&
          (opts.result instanceof Error ||
            Boolean(
              opts.result &&
                typeof opts.result === "object" &&
                "result" in opts.result &&
                (opts.result as { result?: { error?: unknown } }).result?.error
            ));
        return isDownWithError;
      },
    }),
    sanitizeResultLink(),
    httpBatchStreamLink({
      url: `${env.NEXT_PUBLIC_SERVER_URL}/trpc`,
      // Use standard Accept header instead of custom trpc-accept to avoid CORS preflight
      streamHeader: "accept",
      // Avoid sub-2k limits that force POST / split batches and can fail on heavy inputs.
      maxURLLength: 12_000,
      maxItems: 8,
      headers: () => {
        const sessionToken = getSessionToken();

        if (sessionToken) {
          return {
            Authorization: `Bearer ${sessionToken}`,
          };
        }

        return {};
      },
    }),
  ],
});

export const trpc = createTRPCOptionsProxy<AppRouter>({
  client: trpcClient,
  queryClient,
});

/** Vanilla tRPC client for imperative (non-hook) queries in client components */
export { trpcClient };
