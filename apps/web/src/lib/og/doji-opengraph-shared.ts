/**
 * Shared palette, fonts, and helpers for Doji Open Graph images (Share PnL API + market OG).
 * Matches `ShareCard` / `api/share-pnl` visual language.
 */

// Module-level font cache — CDN only hit once per server lifecycle
let _font400: ArrayBuffer | null = null;
let _font500: ArrayBuffer | null = null;

export async function loadInterFontsForOg(): Promise<{
  data400: ArrayBuffer | null;
  data500: ArrayBuffer | null;
}> {
  if (_font400 && _font500) {
    return { data400: _font400, data500: _font500 };
  }
  try {
    const [r400, r500] = await Promise.all([
      fetch(
        "https://cdn.jsdelivr.net/fontsource/fonts/inter@latest/latin-400-normal.woff"
      ),
      fetch(
        "https://cdn.jsdelivr.net/fontsource/fonts/inter@latest/latin-500-normal.woff"
      ),
    ]);
    if (r400.ok) {
      _font400 = await r400.arrayBuffer();
    }
    if (r500.ok) {
      _font500 = await r500.arrayBuffer();
    }
  } catch {
    // Fall back to system sans-serif
  }
  return { data400: _font400, data500: _font500 };
}

/** Doji 2 theme — aligned with `index.css` oklch tokens and share-pnl route */
export const DOJI_OG_PALETTE = {
  card: "#15171e",
  border: "#262931",
  textPrimary: "#f5f5f5",
  textSecondary: "#ababaf",
  textTertiary: "#7a7a80",
  surface2: "#1c1f26",
  mutedFg: "#8a8a91",
  green: "#bff85a",
  red: "#ea4a4d",
  mutedBg: "#292b35",
  /** Grid line color (slightly lighter than share-pnl route for contrast on OG) */
  gridLine: "#0e1014",
} as const;

export function outcomeColorsForOg(_outcome: string): {
  bg: string;
  fg: string;
} {
  return { bg: DOJI_OG_PALETTE.mutedBg, fg: DOJI_OG_PALETTE.mutedFg };
}

export function formatPriceDecimalAsCents(price: number): string {
  return `${Math.round(price * 100)}¢`;
}
