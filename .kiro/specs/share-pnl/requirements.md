# Requirements Document

## Introduction

Doji has existing "Share your PNL" buttons on position rows (portfolio position table, market positions tab) and a disabled "Share PNL" button in the redeem modal. These buttons currently do nothing. This feature builds the complete share-PNL system: a dynamically generated card that visualizes a position's profit/loss data, rendered in a modal with copy-to-clipboard and save-as-image actions. The card follows the Doji design system (dark terminal aesthetic, brand green for profit, red for loss) and is designed for extensibility toward future user editing options (background selection, layout customization).

The card is generated client-side from position data already available in the component tree. No new API endpoints are required. Image generation uses an HTML-to-image approach (e.g. `html-to-image` or `html2canvas`) to capture a styled DOM node as a PNG.

## Glossary

- **Share_Card**: The styled visual card component that displays a position's PNL data, market title, outcome, and Doji branding. Rendered as a React component inside the Share_Modal.
- **Share_Modal**: The dialog that opens when the user clicks a "Share your PNL" button. Contains the Share_Card preview, a copy button, and a save button.
- **Image_Generator**: The client-side module that converts the Share_Card DOM node into a PNG blob using an HTML-to-image library.
- **Position_Data**: The set of fields describing a position: market title, outcome (Yes/No), average price, current/exit price, size (shares), PNL amount (USD), market icon URL, and user profile (avatar URL, username).
- **Copy_Action**: The action that writes the generated PNG image to the user's clipboard via the Clipboard API.
- **Save_Action**: The action that triggers a browser file download of the generated PNG image.
- **PNL_Value**: The unrealized profit or loss in USD for a position, computed via `getPositionUnrealizedPnlDisplayUsd`.
- **Brand_Green**: The Doji brand color (`--doji-green`), used for profit/positive values on the Share_Card.
- **Loss_Red**: The loss/sell color (`--color-loss`), used for loss/negative values on the Share_Card.
- **Card_Background**: The `--card` surface color used as the card's base background.
- **Grid_Overlay**: A subtle grid pattern rendered on the card background using the next-brightest surface color above `--card`.
- **Watermark_Logo**: A large, tilted Doji logo mark (icon only, no wordmark) rendered in the background using the same subtle grid color.

## Requirements

### Requirement 1: Share Modal with Card Preview

**User Story:** As a trader, I want to see a preview of my PNL card before sharing, so that I know what the shared image will look like.

#### Acceptance Criteria

1. WHEN the user clicks a "Share your PNL" button on a position row, THE Share_Modal SHALL open displaying a rendered Share_Card for that position.
2. THE Share_Modal SHALL display the Share_Card at a fixed aspect ratio suitable for social media sharing (approximately 16:9).
3. THE Share_Modal SHALL include a "Copy" button and a "Save" button below the Share_Card preview.
4. WHEN the user closes the Share_Modal, THE Share_Modal SHALL unmount the Share_Card and release any generated image blobs.

### Requirement 2: Share Card Layout and Content

**User Story:** As a trader, I want the PNL card to clearly show my position details and profit/loss in a specific layout, so that the shared image communicates my trading performance.

#### Acceptance Criteria

**Header Row (top of card):**
1. THE Share_Card SHALL display the Doji logo with wordmark (`/doji-logo.svg`) at the top-left of the card.
2. THE Share_Card SHALL display the user's Polymarket profile picture (circular avatar) and username (prefixed with "@") at the top-right of the card.

**Center Section (market info):**
3. THE Share_Card SHALL display the market icon image (rounded square, ~48px) at the left of the market title area; IF the icon URL is unavailable, THEN THE Share_Card SHALL display a fallback character derived from the market title.
4. THE Share_Card SHALL display the market title text from the Position_Data to the right of the market icon, wrapping to multiple lines if needed.
5. THE Share_Card SHALL display the position outcome label (e.g. "Yes", "No", or a named outcome) as a pill/bubble to the right of the market title, using the same styling as the existing `outcomeColorClass` (Yes = green bg/text, No = red bg/text, named = grey).

**Bottom Row (price + PNL):**
6. THE Share_Card SHALL display "Avg Entry Price" label with the average entry price formatted in cents (e.g. "46c") at the bottom-left.
7. THE Share_Card SHALL display "Exit Price" label with the current/exit price formatted in cents at the bottom-center-left.
8. THE Share_Card SHALL display the total PNL_Value at the bottom-right, formatted as a large USD amount with "+" prefix for profit and "-" prefix for loss (e.g. "+$15,643").
9. THE Share_Card SHALL use Brand_Green (`--doji-green`) for the PNL text when PNL_Value is zero or positive, and Loss_Red (`--color-loss`) when PNL_Value is negative.
10. THE price labels ("Avg Entry Price", "Exit Price") SHALL use `text-text-tertiary` color, and the price values SHALL use `text-text-primary` color.

**Background:**
11. THE Share_Card SHALL use the Doji dark theme card color (`--card`) as the base background, regardless of the user's active theme.
12. THE Share_Card SHALL render a subtle grid pattern overlay using the next-brightest surface color above `--card` (e.g. `--surface-1` or `--border-subtle`), creating a barely-visible grid effect.
13. THE Share_Card SHALL render a large, tilted Doji logo mark (icon only from `DojiLogoMarkPaths`, no wordmark) as a watermark in the background, using the same subtle grid color, positioned center-right and rotated approximately 15-20 degrees.

### Requirement 3: Image Generation from Share Card

**User Story:** As a trader, I want the PNL card to be converted into a high-quality image, so that I can share it on social media or messaging apps.

#### Acceptance Criteria

1. WHEN the Share_Modal is open, THE Image_Generator SHALL convert the Share_Card DOM node into a PNG blob.
2. THE Image_Generator SHALL render the PNG at a minimum resolution of 2x the displayed card dimensions (retina quality).
3. THE Image_Generator SHALL embed the market icon image and user avatar in the generated PNG without cross-origin errors by using image proxying or data URL conversion.
4. IF the Image_Generator fails to render the PNG, THEN THE Share_Modal SHALL display an error message using the existing toast notification system.

### Requirement 4: Copy Image to Clipboard

**User Story:** As a trader, I want to copy my PNL card image to my clipboard with one click, so that I can paste it directly into social media or chat apps.

#### Acceptance Criteria

1. WHEN the user clicks the "Copy" button, THE Copy_Action SHALL write the generated PNG blob to the system clipboard using the Clipboard API.
2. WHEN the Copy_Action succeeds, THE Share_Modal SHALL display a success confirmation (e.g. toast notification or button state change).
3. IF the Clipboard API is unavailable or the write fails, THEN THE Copy_Action SHALL display an error message using the existing toast notification system.
4. WHILE the Image_Generator is still rendering the PNG, THE "Copy" button SHALL be disabled.

### Requirement 5: Save Image as File Download

**User Story:** As a trader, I want to download my PNL card as an image file, so that I can save it locally or upload it manually.

#### Acceptance Criteria

1. WHEN the user clicks the "Save" button, THE Save_Action SHALL trigger a browser file download of the generated PNG.
2. THE Save_Action SHALL name the downloaded file using a pattern that includes "doji" and the market title (e.g. `doji-pnl-{market-slug}.png`).
3. WHILE the Image_Generator is still rendering the PNG, THE "Save" button SHALL be disabled.

### Requirement 6: Share PNL from Redeem Modal

**User Story:** As a trader, I want to share my PNL from the redeem modal after a market resolves, so that I can celebrate or commiserate my resolved position.

#### Acceptance Criteria

1. WHEN the user clicks the "Share PNL" button in the Redeem Modal, THE Share_Modal SHALL open displaying a Share_Card populated with the redeemable group's title, icon, bet amount, and PNL.
2. THE Share_Card SHALL compute the PNL percentage from the redeemable group's bet and PNL values.
3. THE "Share PNL" button in the Redeem Modal SHALL be enabled (currently disabled).

### Requirement 7: Consistent Entry Points Across Surfaces

**User Story:** As a trader, I want the share button to work the same way everywhere I see it, so that I have a consistent experience across the portfolio table, market positions tab, and redeem modal.

#### Acceptance Criteria

1. WHEN the user clicks the share button in the portfolio position table (`position-table.tsx`), THE Share_Modal SHALL open with Position_Data from that row.
2. WHEN the user clicks the share button in the market positions tab (`positions-tab.tsx`), THE Share_Modal SHALL open with Position_Data from that row.
3. WHEN the user clicks the share button in the redeem modal (`redeem-modal.tsx`), THE Share_Modal SHALL open with Position_Data derived from the RedeemableGroup.
4. THE Share_Modal component SHALL accept a common data interface so that all three entry points pass position data in the same shape.

### Requirement 8: Extensibility for Future Editing

**User Story:** As a developer, I want the share card system to be structured for future editing capabilities, so that adding background selection or layout options requires minimal refactoring.

#### Acceptance Criteria

1. THE Share_Card SHALL accept its visual configuration (background style, layout variant) as props, separate from the Position_Data.
2. THE Share_Modal SHALL render the Share_Card in a container that can accommodate future editing controls (e.g. a sidebar or toolbar) without restructuring the modal layout.
