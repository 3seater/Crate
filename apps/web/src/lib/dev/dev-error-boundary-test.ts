/**
 * Development-only helpers to trigger intentional errors and exercise `error.tsx` /
 * `global-error` / `not-found` flows.
 *
 * **Server Components:** at the top of an async page:
 *   `await throwIfDevErrorRequestedSearchParams(searchParams);`
 *
 * **URL:** add `?__throw=1` (also `true`, `error`, `yes`). No-op in production builds.
 *
 * **Client render path:** render `<DevErrorThrowClient />` and use `?__throw=client`.
 *
 * @see apps/web/src/app/dev/error-test/page.tsx
 */

export const DEV_ERROR_QUERY_PARAM = "__throw" as const;

/** Values for {@link DEV_ERROR_QUERY_PARAM} that trigger a server throw. */
const SERVER_THROW_VALUES = new Set(["1", "true", "error", "yes"]);

export function isDevErrorBoundaryTestEnabled(): boolean {
  return process.env.NODE_ENV === "development";
}

function firstString(value: string | string[] | undefined): string | undefined {
  if (value === undefined) {
    return;
  }
  return Array.isArray(value) ? value[0] : value;
}

function shouldThrowServer(value: string | undefined): boolean {
  if (value === undefined) {
    return false;
  }
  return SERVER_THROW_VALUES.has(value.trim().toLowerCase());
}

/**
 * Throws in **development** if the request asks for a test error. Pass the resolved
 * `searchParams` object from the App Router page (after `await searchParams`).
 */
export function throwIfDevErrorRequested(
  searchParams: Record<string, string | string[] | undefined>
): void {
  if (!isDevErrorBoundaryTestEnabled()) {
    return;
  }
  const raw = firstString(searchParams[DEV_ERROR_QUERY_PARAM]);
  if (!shouldThrowServer(raw)) {
    return;
  }
  throw new Error(
    "[dev] Intentional server error boundary test — remove ?__throw= from the URL"
  );
}

export async function throwIfDevErrorRequestedSearchParams(
  searchParams: Promise<Record<string, string | string[] | undefined>>
): Promise<void> {
  if (!isDevErrorBoundaryTestEnabled()) {
    return;
  }
  const sp = await searchParams;
  throwIfDevErrorRequested(sp);
}

/**
 * Build a URL with the dev error query flag (for links / copy-paste).
 */
export function withDevErrorQuery(path: string): string {
  const sep = path.includes("?") ? "&" : "?";
  return `${path}${sep}${DEV_ERROR_QUERY_PARAM}=1`;
}

/**
 * If the current URL includes the dev `__throw` flag, returns the same path without
 * it so "Try again" can recover (otherwise `reset()` re-renders and throws again).
 * Returns `null` when there is nothing to strip (production, or param absent).
 */
export function stripDevErrorQueryFromCurrentLocation(): string | null {
  if (typeof window === "undefined" || !isDevErrorBoundaryTestEnabled()) {
    return null;
  }
  const url = new URL(window.location.href);
  if (!url.searchParams.has(DEV_ERROR_QUERY_PARAM)) {
    return null;
  }
  url.searchParams.delete(DEV_ERROR_QUERY_PARAM);
  const qs = url.searchParams.toString();
  return `${url.pathname}${qs ? `?${qs}` : ""}${url.hash}`;
}
