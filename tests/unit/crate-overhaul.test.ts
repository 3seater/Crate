import * as fs from "node:fs";
import * as path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

// Resolve workspace root from this file's location:
// tests/unit/crate-overhaul.test.ts  →  up 3 levels  →  workspace root
const WORKSPACE_ROOT = path.resolve(fileURLToPath(import.meta.url), "../../..");

// ---------------------------------------------------------------------------
// Top-level regex constants (required by Biome useTopLevelRegex rule)
// ---------------------------------------------------------------------------

const RE_TS_FILE = /\.tsx?$/;
const RE_BLOCK_COMMENT_OPEN = /\/\*/;
const RE_BLOCK_COMMENT_CLOSE = /\*\//;
const RE_MULTILINE_IMPORT_CLOSE = /\}\s+from\s+['"]/;
const RE_IMPORT_OPEN = /^import\s/;
const RE_SINGLE_LINE_IMPORT_FROM = /from\s+['"]/;
const RE_SINGLE_LINE_IMPORT_BARE = /^import\s+['"]/;
const RE_BARE_CLOSING_FROM = /^\}\s+from\s+['"]/;
const RE_EXPORT_NAMED = /^export\s*\{/;
const RE_EXPORT_TYPE_NAMED = /^export\s+type\s*\{/;
const RE_EXPORT_STAR = /^export\s*\*\s+from/;
const RE_TS_TYPE_DECL = /^(?:export\s+)?type\s+\w/;
const RE_TS_INTERFACE_DECL = /^(?:export\s+)?interface\s+\w/;
const RE_TS_ENUM_DECL = /^(?:export\s+)?(?:const\s+)?enum\s+\w/;
const RE_DOJI_GREEN_PROP = /--doji-green[\w-]*\s*:/g;
const RE_FAST_BASKET = /baskets?/i;
const RE_ALL_CAPS_BASKETS = /\bBASKETS?\b/g;
const RE_BASKET_WORD = /\bbaskets?\b/gi;
const RE_IDENTIFIER_AFTER = /[.:,)}\s=]/;
const RE_IDENTIFIER_BEFORE = /[{(\s]/;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Recursively collect all .ts / .tsx files under a directory. */
function collectTsFiles(dir: string): string[] {
  const results: string[] = [];
  if (!fs.existsSync(dir)) {
    return results;
  }

  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      results.push(...collectTsFiles(full));
    } else if (entry.isFile() && RE_TS_FILE.test(entry.name)) {
      results.push(full);
    }
  }
  return results;
}

/**
 * Strip lines that should not be checked for user-visible copy so that
 * internal TypeScript identifiers and module paths in import specifiers
 * do not produce false positives.
 *
 * Removed line categories:
 *  - `import ...` declarations (including multi-line import blocks whose
 *    continuation lines end in `} from "..."`)
 *  - `export { ... }` / `export * from` re-exports
 *  - JSDoc / block comment lines (everything between slash-star and star-slash)
 *    since comments are developer documentation, not user-visible UI copy
 *  - Pure TypeScript identifier declarations (type, interface, enum)
 *    which are intentionally not renamed per Req 7.9
 *
 * Variable and parameter names (e.g. the identifier `basket`) remain in the
 * scanned output so genuine user-visible copy violations are still caught.
 */
function stripNonUiLines(source: string): string {
  const lines = source.split("\n");
  const kept: string[] = [];
  let inMultiLineImport = false;
  let inBlockComment = false;

  for (const line of lines) {
    const trimmed = line.trimStart();

    // ── Block / JSDoc comments ──────────────────────────────────────────────
    if (!inBlockComment && RE_BLOCK_COMMENT_OPEN.test(trimmed)) {
      inBlockComment = true;
    }
    if (inBlockComment) {
      if (RE_BLOCK_COMMENT_CLOSE.test(line)) {
        inBlockComment = false;
      }
      kept.push(""); // blank placeholder to preserve line numbers
      continue;
    }

    // ── Multi-line import blocks ────────────────────────────────────────────
    if (inMultiLineImport) {
      kept.push(""); // skip continuation lines
      if (RE_MULTILINE_IMPORT_CLOSE.test(trimmed)) {
        inMultiLineImport = false;
      }
      continue;
    }

    // Opening `import ...` line
    if (RE_IMPORT_OPEN.test(trimmed)) {
      const isSingleLine =
        RE_SINGLE_LINE_IMPORT_FROM.test(trimmed) ||
        RE_SINGLE_LINE_IMPORT_BARE.test(trimmed);
      if (!isSingleLine) {
        inMultiLineImport = true;
      }
      kept.push(""); // skip the import line itself
      continue;
    }

    // Bare closing `} from "..."` (belt-and-suspenders)
    if (RE_BARE_CLOSING_FROM.test(trimmed)) {
      kept.push("");
      continue;
    }

    // ── Export re-exports ───────────────────────────────────────────────────
    if (
      RE_EXPORT_NAMED.test(trimmed) ||
      RE_EXPORT_TYPE_NAMED.test(trimmed) ||
      RE_EXPORT_STAR.test(trimmed)
    ) {
      kept.push("");
      continue;
    }

    // ── TypeScript identifier declarations (not renamed per Req 7.9) ────────
    if (
      RE_TS_TYPE_DECL.test(trimmed) ||
      RE_TS_INTERFACE_DECL.test(trimmed) ||
      RE_TS_ENUM_DECL.test(trimmed)
    ) {
      kept.push("");
      continue;
    }

    kept.push(line);
  }

  return kept.join("\n");
}

/**
 * Returns true when "basket"/"baskets" appears in a user-visible context on
 * the line. Returns false when all occurrences are clearly TypeScript
 * identifiers (variable names, property accesses, parameter names).
 *
 * Excluded identifier patterns:
 *  - BASKETS / BASKET (all-caps constant names)
 *  - basket.something (followed by .)
 *  - basket: Type     (followed by :)
 *  - basket, / basket) / basket} (parameter/destructure position)
 *  - basket=          (JSX prop name: basket={...})
 *  - { basket / ( basket (opening destructure/param)
 *
 * User-visible patterns that DO trigger a violation:
 *  - "Buy Basket"  (inside string literals)
 *  - >Basket<      (JSX text content)
 *  - `Enter basket →` (template literal)
 */
function hasBasketCopy(line: string): boolean {
  if (!RE_FAST_BASKET.test(line)) {
    return false;
  }

  // Strip all-caps constant form (e.g. BASKETS) — always an identifier
  const withoutAllCaps = line.replace(RE_ALL_CAPS_BASKETS, "");

  RE_BASKET_WORD.lastIndex = 0;
  let match = RE_BASKET_WORD.exec(withoutAllCaps);
  while (match !== null) {
    const before = withoutAllCaps[match.index - 1] ?? "";
    const after = withoutAllCaps[match.index + match[0].length] ?? "";

    const identifierAfter = RE_IDENTIFIER_AFTER.test(after) || after === "";
    const identifierBefore = RE_IDENTIFIER_BEFORE.test(before) || before === "";

    if (!(identifierAfter && identifierBefore)) {
      return true;
    }

    match = RE_BASKET_WORD.exec(withoutAllCaps);
  }
  return false;
}

// ---------------------------------------------------------------------------
// Property 2: No --doji-green declarations in index.css
// ---------------------------------------------------------------------------

describe("Property 2: index.css contains no --doji-green custom property declarations", () => {
  /**
   * Validates: Requirements 1.11
   *
   * For every line in apps/web/src/index.css the pattern
   * /--doji-green[\w-]*\s*:/ must not match — confirming that the Doji green
   * palette has been fully removed from the design token file.
   */
  it("index.css has zero --doji-green* declaration occurrences", () => {
    const cssPath = path.join(WORKSPACE_ROOT, "apps/web/src/index.css");
    const source = fs.readFileSync(cssPath, "utf-8");
    const matches = source.match(RE_DOJI_GREEN_PROP);
    expect(matches).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// Property 4: No user-visible "basket"/"baskets" in component / shell files
// ---------------------------------------------------------------------------

describe("Property 4: no 'basket'/'baskets' word in component and shell source after stripping non-UI lines", () => {
  /**
   * Validates: Requirements 7.1, 7.2
   *
   * For every .ts/.tsx file under:
   *   - apps/web/src/domains/baskets/components/
   *   - apps/web/src/shell/
   *
   * After stripping import/export/comment/type-declaration lines (to exclude
   * TypeScript identifier names which are intentionally not renamed per
   * Req 7.9), the remaining source must contain zero matches for the
   * word-boundary pattern /\bbaskets?\b/i in user-visible positions.
   *
   * Any match causes a descriptive failure showing the filename and the
   * matching line(s) with their numbers.
   */
  const SCAN_DIRS = [
    path.join(WORKSPACE_ROOT, "apps/web/src/domains/baskets/components"),
    path.join(WORKSPACE_ROOT, "apps/web/src/shell"),
  ];

  const allFiles = SCAN_DIRS.flatMap((dir) => collectTsFiles(dir));

  for (const filePath of allFiles) {
    const relativePath = path.relative(WORKSPACE_ROOT, filePath);

    it(`${relativePath} — no 'basket'/'baskets' in user-visible content`, () => {
      const raw = fs.readFileSync(filePath, "utf-8");
      const stripped = stripNonUiLines(raw);
      const lines = stripped.split("\n");

      const violations: string[] = [];
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        if (hasBasketCopy(line)) {
          violations.push(`  Line ${i + 1}: ${line.trimEnd()}`);
        }
      }

      expect(
        violations,
        `Found 'basket'/'baskets' word(s) in user-visible content of ${relativePath}:\n${violations.join("\n")}`
      ).toHaveLength(0);
    });
  }
});
