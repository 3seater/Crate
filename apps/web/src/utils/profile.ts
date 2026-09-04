/**
 * Shared profile utilities used across multiple components.
 * Pure helpers with no framework or app imports.
 */

interface ProfileLike {
  displayUsernamePublic?: boolean | unknown;
  name?: string | unknown;
  pseudonym?: string | unknown;
}

/**
 * Extract a display name from a Polymarket/Gamma profile object.
 * Returns the resolved name, or `null` if none available.
 */
export function getProfileDisplayName(
  profile: ProfileLike | null | undefined
): string | null {
  if (!profile) {
    return null;
  }

  const nameStr = typeof profile.name === "string" ? profile.name.trim() : null;
  const pseudonymStr =
    typeof profile.pseudonym === "string" ? profile.pseudonym.trim() : null;

  if (profile.displayUsernamePublic) {
    return nameStr || pseudonymStr || null;
  }

  return pseudonymStr || null;
}

/**
 * First letter for an avatar fallback.
 * Prefers the 3rd character of a hex address (after "0x"), then the first
 * character of the display name.
 */
export function getAvatarLetter(displayName: string, address?: string): string {
  if (address?.startsWith("0x") && address.length > 2) {
    return address[2]?.toUpperCase() ?? "?";
  }
  const c = displayName?.trim().charAt(0);
  return c ? c.toUpperCase() : "?";
}
