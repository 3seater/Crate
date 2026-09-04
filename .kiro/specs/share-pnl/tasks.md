# Tasks: Share PNL

## Task 1: Create shared types and data normalization utilities

- [x] 1.1 Create `apps/web/src/components/share-pnl/types.ts` with `SharePnlData` and `ShareCardConfig` interfaces
- [x] 1.2 Create `apps/web/src/components/share-pnl/share-pnl-utils.ts` with `toSharePnlData` functions that convert `Position` and `RedeemableGroup` into `SharePnlData`, plus `formatPriceCentsForCard`, `formatPnlForCard`, `pnlColorClass`, `outcomeColorClassForCard`, and `generateFilename` helpers
- [x] 1.3 Write property-based tests in `tests/unit/share-pnl.test.ts` for Properties 3–8 (outcome color mapping, price formatting, PNL display, filename pattern, data normalization, PNL percentage)

## Task 2: Build the ShareCard component

- [x] 2.1 Create `apps/web/src/components/share-pnl/share-card.tsx` — presentational component with forced dark theme wrapper (`doji` class), header row (Doji logo + avatar/@username), center section (market icon with fallback + title + outcome pill), bottom row (avg entry price + exit price + large PNL), and background (card color + grid overlay + tilted DojiLogoMarkPaths watermark)
- [x] 2.2 Write property-based tests for Properties 1–2 (card content completeness, icon fallback character) in `tests/unit/share-pnl.test.ts`

## Task 3: Build the useShareImage hook and share actions

- [x] 3.1 Install `html-to-image` dependency: `pnpm add html-to-image --filter web`
- [x] 3.2 Create `apps/web/src/components/share-pnl/use-share-image.ts` — hook that takes a card ref, converts external images to data URLs, calls `toPng` with `pixelRatio: 2`, and exposes `{ blob, isRendering, error, regenerate }`
- [x] 3.3 Create `apps/web/src/components/share-pnl/share-actions.ts` with `copyImageToClipboard` (Clipboard API write) and `saveImageAsFile` (temporary anchor download with `doji-pnl-{slug}.png` filename)

## Task 4: Build the SharePnlModal component

- [x] 4.1 Create `apps/web/src/components/share-pnl/share-pnl-modal.tsx` — Dialog-based modal that renders ShareCard preview, Copy button, Save button, handles disabled states while rendering, and shows toast on success/error
- [x] 4.2 Write unit tests for modal behavior (button disabled states, copy success/error toasts, save triggers download, image generation error handling)

## Task 5: Wire up entry points

- [x] 5.1 Update `apps/web/src/components/portfolio/position-table.tsx` — add state for share modal, wire Share2 button onClick to open `SharePnlModal` with `toSharePnlData(position)`
- [x] 5.2 Update `apps/web/src/components/market/tabs/positions-tab.tsx` — same pattern as 5.1 for the market positions tab Share2 button
- [x] 5.3 Update `apps/web/src/components/portfolio/redeem-modal.tsx` — enable the "Share PNL" button, wire onClick to open `SharePnlModal` with `toSharePnlData(redeemableGroup)`
- [x] 5.4 Verify all three entry points open the modal with correct data and run `pnpm check-types` to confirm no type errors
