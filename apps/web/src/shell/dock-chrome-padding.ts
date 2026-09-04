/**
 * Horizontal padding for docked widget chrome (headers, tabs, tables).
 * The inner edge reserves space for the 8px resize lane so content lines up
 * with the same inset as the main app frame (e.g. header logo column).
 */
export function getDockChromePaddingClass(
  docked: boolean,
  dockedSide: "left" | "right" | null
): string {
  if (!docked) {
    return "px-6";
  }
  if (dockedSide === "left") {
    return "pl-4 pr-6";
  }
  if (dockedSide === "right") {
    return "pl-6 pr-4";
  }
  return "px-4";
}
