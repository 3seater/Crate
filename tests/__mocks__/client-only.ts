/**
 * Vitest runs in Node; the real `client-only` package throws when `window` is undefined.
 * Alias this in `vitest.config.mts` so `@/shared/lib/trpc` and similar can load in unit tests.
 */
export {};
