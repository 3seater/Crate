/**
 * Parse a cookie (or other) string against an allow-list; invalid/missing → default.
 */
export function parseAllowedString<T extends string>(
  raw: string | undefined,
  allowed: readonly T[],
  defaultValue: T
): T {
  const allowedSet = new Set<string>(allowed);
  if (raw !== undefined && allowedSet.has(raw)) {
    return raw as T;
  }
  return defaultValue;
}
