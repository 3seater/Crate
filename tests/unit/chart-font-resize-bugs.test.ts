/**
 * Bug condition exploration tests for chart font / resize / defaults bugs.
 *
 * **Property 1: Bug Condition** — Chart Font Drift & Default State Bugs
 *
 * **Validates: Requirements 1.1, 1.2, 1.3, 1.4, 1.5**
 *
 * These tests encode the EXPECTED (correct) behavior. On unfixed code they
 * MUST FAIL — failure confirms the bugs exist. After the fix is applied the
 * same tests should pass, proving the bugs are resolved.
 */

import * as fs from "node:fs";
import * as path from "node:path";
import { describe, expect, it } from "vitest";

import {
  CHART_HEIGHT_DEFAULT,
  useWorkspaceLayoutStore,
} from "../../apps/web/src/stores/workspace-layout";

// Top-level regex constants (biome lint/performance/useTopLevelRegex)
const STYLES_IN_INIT_RE = /styles:\s*initStyles/;
const CHART_TYPE_DEFAULT_RE = /chartType\s*=\s*["'](\w+)["']\s*[,}]/;
const YAXIS_SIZE_RE = /yAxis:\s*\{[^}]*size:\s*(\d+)/s;

// ────────────────────────────────────────────────────────────────────────────
// Bug 1: Resize font drift
// ────────────────────────────────────────────────────────────────────────────
describe("Bug 1 — Resize font drift (Property 1)", () => {
  /**
   * Styles must be passed at init() time so they become the chart's base
   * styles. The y-axis must have a fixed width to prevent layout jitter
   * during resize. No setStyles() re-application should be needed.
   *
   * On unfixed code: styles not passed at init, y-axis width is "auto" → FAIL
   * On fixed code: styles passed at init, y-axis has fixed width → PASS
   */
  it("styles are passed at init() time (not applied after)", () => {
    const innerSrc = fs.readFileSync(
      path.resolve(
        import.meta.dirname,
        "../../apps/web/src/components/charts/polymarket-kline-chart-inner.tsx"
      ),
      "utf-8"
    );

    // Verify styles are passed in the init() options
    expect(innerSrc).toMatch(STYLES_IN_INIT_RE);
  });

  it("y-axis has a fixed width to prevent layout jitter", () => {
    const themeSrc = fs.readFileSync(
      path.resolve(
        import.meta.dirname,
        "../../apps/web/src/components/charts/kline-chart-theme.ts"
      ),
      "utf-8"
    );

    // Verify yAxis.size is a fixed number (not "auto")
    const match = themeSrc.match(YAXIS_SIZE_RE);
    expect(match).not.toBeNull();
    const yAxisSize = Number(match?.[1]);
    expect(yAxisSize).toBeGreaterThanOrEqual(50);
  });
});

// ────────────────────────────────────────────────────────────────────────────
// Bug 2: Mode + side toggle race condition
// ────────────────────────────────────────────────────────────────────────────
describe("Bug 2 — Mode+side toggle race (Property 1)", () => {
  /**
   * klinecharts persists _styles across all operations (resize, setPeriod,
   * resetData). With styles passed at init and a fixed y-axis width, there
   * is no race condition — Effect 4 only needs a single setStyles() call
   * to update candle type, and no concurrent operation can overwrite it.
   *
   * We verify that Effect 4 exists and calls setStyles() for chart type changes.
   */
  it("Effect 4 applies styles on chartType/theme change", () => {
    const innerSrc = fs.readFileSync(
      path.resolve(
        import.meta.dirname,
        "../../apps/web/src/components/charts/polymarket-kline-chart-inner.tsx"
      ),
      "utf-8"
    );

    const effect4Marker = innerSrc.indexOf(
      "Effect 4: Chart type / theme style sync"
    );
    expect(effect4Marker).toBeGreaterThan(-1);

    const effect4Region = innerSrc.slice(effect4Marker, effect4Marker + 800);

    // Effect 4 should call setStyles to update candle type
    expect(effect4Region).toContain("chart.setStyles(");
    // Effect 4 should depend on chartType and theme
    expect(effect4Region).toContain("[chartType, theme]");
  });
});

// ────────────────────────────────────────────────────────────────────────────
// Bug 3: Default height toolbar cutoff
// ────────────────────────────────────────────────────────────────────────────
describe("Bug 3 — Default height toolbar cutoff (Property 1)", () => {
  /**
   * CHART_HEIGHT_DEFAULT is 55 on unfixed code, which clips the toolbar on
   * viewports <= 1080p. The fix bumps it to >= 65.
   */
  it("CHART_HEIGHT_DEFAULT is >= 65", () => {
    // On unfixed code: CHART_HEIGHT_DEFAULT === 55 → FAIL
    // On fixed code: CHART_HEIGHT_DEFAULT === 65 → PASS
    expect(CHART_HEIGHT_DEFAULT).toBeGreaterThanOrEqual(65);
  });
});

// ────────────────────────────────────────────────────────────────────────────
// Bug 4: Wrong default chart mode
// ────────────────────────────────────────────────────────────────────────────
describe("Bug 4 — Wrong default chart mode (Property 1)", () => {
  /**
   * PolymarketKLineChartInner has chartType = "candle" as its default prop.
   * The fix changes it to "line".
   *
   * We verify the source code's default prop value.
   */
  it('default chartType prop is "line" (not "candle")', () => {
    const innerSrc = fs.readFileSync(
      path.resolve(
        import.meta.dirname,
        "../../apps/web/src/components/charts/polymarket-kline-chart-inner.tsx"
      ),
      "utf-8"
    );

    // Find the props destructuring with the default value for chartType
    // Pattern: chartType = "candle" or chartType = "line"
    const defaultMatch = innerSrc.match(CHART_TYPE_DEFAULT_RE);
    expect(defaultMatch).not.toBeNull();

    const defaultValue = defaultMatch?.[1];

    // On unfixed code: defaultValue === "candle" → FAIL
    // On fixed code: defaultValue === "line" → PASS
    expect(defaultValue).toBe("line");
  });
});

// ────────────────────────────────────────────────────────────────────────────
// Bug 5: Preference hydration race
// ────────────────────────────────────────────────────────────────────────────
describe("Bug 5 — Preference hydration race (Property 1)", () => {
  /**
   * On unfixed code, chart type lives in a separate useSyncExternalStore
   * mechanism, not in the zustand workspace-layout store. This causes a
   * hydration race where chartHeight restores but chartType doesn't.
   *
   * The fix unifies chartType into useWorkspaceLayoutStore.
   */
  it("useWorkspaceLayoutStore contains a chartType field", () => {
    const state = useWorkspaceLayoutStore.getState();

    // On unfixed code: state has no chartType field → FAIL
    // On fixed code: state.chartType exists ("line" or "candle") → PASS
    expect(state).toHaveProperty("chartType");
    expect(["candle", "line"]).toContain(
      (state as Record<string, unknown>).chartType
    );
  });

  it("useWorkspaceLayoutStore contains a setChartType action", () => {
    const state = useWorkspaceLayoutStore.getState();

    // On unfixed code: no setChartType → FAIL
    // On fixed code: setChartType is a function → PASS
    expect(state).toHaveProperty("setChartType");
    expect(typeof (state as Record<string, unknown>).setChartType).toBe(
      "function"
    );
  });
});
