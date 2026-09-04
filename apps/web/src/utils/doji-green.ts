import "client-only";

const RE_HEX_RGB = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i;

/**
 * Read --doji-green from CSS at runtime.
 * Use for chart configs (Lightweight Charts expects hex/rgba, not CSS variables).
 */
export function getDojiGreen(): string {
  if (typeof document === "undefined") {
    return "#90e65b";
  }
  return (
    getComputedStyle(document.body).getPropertyValue("--doji-green").trim() ||
    "#90e65b"
  );
}

/**
 * Read --color-sell from CSS at runtime for chart sell/down colors.
 */
export function getColorSell(): string {
  if (typeof document === "undefined") {
    return "#f83f42";
  }
  return (
    getComputedStyle(document.body).getPropertyValue("--color-sell").trim() ||
    "#f83f42"
  );
}

/** Convert hex to rgb components for rgba() strings. */
export function hexToRgb(hex: string): { r: number; g: number; b: number } {
  const result = RE_HEX_RGB.exec(hex);
  return result
    ? {
        r: Number.parseInt(result[1], 16),
        g: Number.parseInt(result[2], 16),
        b: Number.parseInt(result[3], 16),
      }
    : { r: 144, g: 230, b: 91 };
}

/** Get doji green as hex and rgb components for chart rgba() strings. */
export function getDojiGreenRgba(): {
  hex: string;
  rgba: { r: number; g: number; b: number };
} {
  const hex = getDojiGreen();
  return { hex, rgba: hexToRgb(hex) };
}
