/**
 * Normalize PostgreSQL connection URL for pg/pg-connection-string.
 * Replaces deprecated sslmode values (prefer, require, verify-ca) with
 * sslmode=verify-full so we keep current strict behavior and silence the
 * pg-connection-string v3 / pg v9 security warning.
 * @see https://www.postgresql.org/docs/current/libpq-ssl.html
 */
export function normalizeConnectionUrl(url: string | undefined): string {
  if (!url) {
    return "";
  }
  try {
    const u = new URL(url);
    const sslmode = u.searchParams.get("sslmode");
    if (
      sslmode === "require" ||
      sslmode === "prefer" ||
      sslmode === "verify-ca"
    ) {
      u.searchParams.set("sslmode", "verify-full");
      return u.toString();
    }
    return url;
  } catch {
    return url ?? "";
  }
}
