export interface ClientCookieOptions {
  maxAgeSeconds?: number;
  path?: string;
  sameSite?: "Lax" | "Strict" | "None";
  /** Defaults to true in production when omitted. */
  secure?: boolean;
}

/**
 * Set a non-HttpOnly cookie from the browser (e.g. UI preferences).
 * Aligns with session route: Path, SameSite=Lax, Secure in prod.
 */
export function setClientCookie(
  name: string,
  value: string,
  options: ClientCookieOptions = {}
): void {
  if (typeof document === "undefined") {
    return;
  }
  const maxAgeSeconds = options.maxAgeSeconds ?? 60 * 60 * 24 * 365;
  const path = options.path ?? "/";
  const sameSite = options.sameSite ?? "Lax";
  const secure = options.secure ?? process.env.NODE_ENV === "production";

  const segments = [
    `${name}=${encodeURIComponent(value)}`,
    `Path=${path}`,
    `Max-Age=${maxAgeSeconds}`,
    `SameSite=${sameSite}`,
  ];
  if (secure) {
    segments.push("Secure");
  }
  // biome-ignore lint/suspicious/noDocumentCookie: intentional client preference sync; Cookie Store API not universally available
  document.cookie = segments.join("; ");
}
