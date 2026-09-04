# Requirements Document

## Introduction

Sports market cards on the Doji explore page display moneyline outcome buttons for each team (e.g. "Spurs", "Leeds") and optionally a "Draw" button. Currently all sports buttons use the same static color system: Team A gets `bg-positive/10` with `text-positive`, Team B gets `bg-negative/10` with `text-negative`.

This feature introduces dynamic team colors derived from each team's logo image — mirroring how Polymarket styles its sports market buttons. The dominant color is extracted from the logo, then two variants are generated: a darkened/desaturated version for the button background and the vivid version for the button text. The Draw button always retains neutral styling.

The team logo images are already fetched via the Gamma `/teams` API and stored in the `teamImages` map that flows through `useBatchedTeamImages` → `EventCard` → `SportsButtons`. Color extraction builds on this existing pipeline.

## Glossary

- **Team_Color_Extractor**: The client-side utility that extracts the dominant color from a team logo image URL using an HTML Canvas element.
- **Team_Color_Palette**: A pair of derived colors for one team: `bg` (darkened/desaturated background) and `text` (vivid foreground), both expressed as CSS color strings.
- **Team_Color_Cache**: An in-memory (and optionally sessionStorage-backed) map from logo URL to `Team_Color_Palette`, preventing redundant extraction on re-renders.
- **SportsButtons**: The React component in `event-card.tsx` that renders the moneyline action buttons at the bottom of a sports event card.
- **Moneyline_Button**: A single outcome button in `SportsButtons` representing one team's win outcome.
- **Draw_Button**: The neutral outcome button in 3-way markets (e.g. soccer) that represents a draw result.
- **Vivid_Color**: The extracted dominant color at full saturation/brightness, used as button text.
- **Muted_Color**: A darkened and desaturated variant of the vivid color, used as button background (analogous to `bg-positive/10`).
- **Fallback_Color**: The existing static color used when no team logo is available or extraction fails — `positive` for Team A, `negative` for Team B.

---

## Requirements

### Requirement 1: Color Extraction from Team Logo

**User Story:** As a user browsing sports markets, I want each team's button to display colors derived from that team's logo, so that I can visually identify teams at a glance.

#### Acceptance Criteria

1. WHEN a team logo URL is available and the image loads successfully, THE Team_Color_Extractor SHALL extract the dominant color from the image by sampling pixel data via an HTML Canvas element.
2. WHEN the Team_Color_Extractor processes an image, THE Team_Color_Extractor SHALL return a `Team_Color_Palette` containing a `bg` CSS color string and a `text` CSS color string.
3. WHEN the Team_Color_Extractor generates a `Team_Color_Palette`, THE Team_Color_Extractor SHALL produce a `bg` color with lightness at most 25% (in OKLCH) to ensure it reads as a dark muted background on the dark Doji theme.
4. WHEN the Team_Color_Extractor generates a `Team_Color_Palette`, THE Team_Color_Extractor SHALL produce a `text` color with lightness of at least 60% (in OKLCH) to ensure legibility against the dark background.
5. IF a team logo URL is null, empty, or matches the generic Polymarket soccer ball image pattern, THEN THE Team_Color_Extractor SHALL return null (no palette), triggering the Fallback_Color.
6. IF the image fails to load (network error, CORS block, invalid URL, or the load does not complete successfully within the extraction attempt), THEN THE Team_Color_Extractor SHALL return null (no palette) without throwing an error — any non-success outcome is treated as failure.
7. WHEN the Team_Color_Extractor processes an image, THE Team_Color_Extractor SHALL complete extraction within 200ms on a modern browser to avoid visible layout shifts.

---

### Requirement 2: Team Color Caching

**User Story:** As a developer, I want extracted team colors to be cached, so that repeated renders of the same card do not re-extract colors from the same image.

#### Acceptance Criteria

1. THE Team_Color_Cache SHALL store extracted `Team_Color_Palette` values keyed by logo URL.
2. WHEN the Team_Color_Extractor is called with a URL already present in the Team_Color_Cache, THE Team_Color_Cache SHALL return the cached palette without re-extracting from the image.
3. WHEN the Team_Color_Extractor is called with the same URL multiple times concurrently, THE Team_Color_Cache SHALL deduplicate in-flight requests so the image is fetched and processed at most once.
4. THE Team_Color_Cache SHALL persist extracted palettes to `sessionStorage` under the key `doji:team-colors` so colors survive page navigation within the same session.
5. IF reading from or writing to `sessionStorage` throws (e.g. quota exceeded or private browsing), THEN THE Team_Color_Cache SHALL silently fall back to in-memory caching only.
6. FOR ALL logo URLs, extracting then caching then retrieving SHALL return an equivalent `Team_Color_Palette` (round-trip property).

---

### Requirement 3: Apply Team Colors to Sports Moneyline Buttons

**User Story:** As a user, I want each team's moneyline button to display that team's brand colors as background and text, so that the buttons feel visually connected to the team logos shown above them.

#### Acceptance Criteria

1. WHEN a `Team_Color_Palette` is available for a team, THE SportsButtons component SHALL apply the palette's `bg` value as the button background color and the palette's `text` value as the button text color via inline `style` props.
2. WHEN a `Team_Color_Palette` is not available for a team (null palette or extraction in progress), THE SportsButtons component SHALL render the Moneyline_Button using the existing Fallback_Color system (`bg-positive/10 text-positive` for Team A, `bg-negative/10 text-negative` for Team B).
3. WHEN team colors are applied, THE SportsButtons component SHALL preserve the existing hover state by lightening the background color by 10% on hover (using `color-mix(in oklch, <bg> 110%, white)` or equivalent).
4. THE SportsButtons component SHALL apply team colors consistently across all three sports button layouts: 2-way binary, 3-way soccer (Team A / Draw / Team B), and esports title-derived fallback.
5. WHEN team colors transition from loading (fallback) to resolved (palette), THE SportsButtons component SHALL apply the new colors without a visible flash by using CSS `transition: background-color 150ms ease, color 150ms ease` — the transition activates when the palette becomes available and is applied to the buttons.

---

### Requirement 4: Draw Button Neutral Styling

**User Story:** As a user, I want the Draw button in 3-way soccer markets to always use neutral styling, so that it is visually distinct from the two team-colored buttons.

#### Acceptance Criteria

1. THE Draw_Button SHALL always render with `bg-muted-foreground/10` background and `text-muted-foreground` text color, regardless of any team color extraction results, failures, or disabled state.
2. WHEN team colors are applied to Team A and Team B buttons, THE Draw_Button SHALL NOT derive any color from either team's logo.
3. THE Draw_Button SHALL maintain its existing hover state (`hover:bg-muted-foreground/20`) unchanged.

---

### Requirement 5: Integration with Existing Team Image Pipeline

**User Story:** As a developer, I want team color extraction to integrate with the existing batched team image pipeline, so that colors are derived from the same logo URLs already fetched for the team rows above the buttons.

#### Acceptance Criteria

1. WHEN `useBatchedTeamImages` resolves team logo URLs for a set of events, THE Team_Color_Extractor SHALL be triggered for each resolved logo URL that is not already in the Team_Color_Cache.
2. THE Team_Color_Extractor SHALL use the same logo URL that is stored in the `teamImages` map (keyed by lowercased team name) — no additional API calls are required.
3. WHEN the `teamImages` prop is passed to `EventCard` from `EventsDiscovery`, THE EventCard component SHALL derive team color palettes from those images and pass them down to `SportsButtons` only when extraction succeeds — no palette is passed on failure.
4. WHEN `EventCard` is used in standalone mode (no prefetched `teamImages`), THE EventCard component SHALL derive team color palettes from the per-card `useTeamImages` query result.
5. THE Team_Color_Extractor SHALL only run in the browser (client-side) and SHALL NOT be called during server-side rendering or static generation.

---

### Requirement 6: Accessibility and Contrast

**User Story:** As a user with visual impairments, I want team-colored buttons to maintain sufficient contrast between text and background, so that I can read the team labels clearly.

#### Acceptance Criteria

1. WHEN a `Team_Color_Palette` is generated, THE Team_Color_Extractor SHALL verify that the contrast ratio between `text` and `bg` meets WCAG AA for normal text (minimum 4.5:1).
2. IF the contrast ratio between the derived `text` and `bg` colors is below 4.5:1, THEN THE Team_Color_Extractor SHALL adjust the `text` color lightness upward (in OKLCH) until the contrast requirement is met, up to a maximum lightness of 95%.
3. IF the contrast ratio cannot be achieved within the lightness bounds, THEN THE Team_Color_Extractor SHALL return null (triggering the Fallback_Color) rather than rendering an inaccessible button — this only applies when contrast is genuinely inadequate; if contrast already meets requirements, the system proceeds normally.
