# Bugfix Requirements Document

## Introduction

Sports event cards in the Explore grid exhibit severe cascading layout shift when first rendered (no sessionStorage cache). The loading chain — team logos → button labels → button colors — resolves sequentially, causing 4–5 visible intermediate states before the card reaches its final appearance. Each async dependency triggers a re-render that shifts layout, replaces fallback content, and changes colors, making the card view feel broken and janky.

The root cause is that the card renders immediately with fallback/placeholder content and then progressively replaces each piece as async data arrives: league logos swap to team logos, slug-parsed abbreviations swap to API abbreviations, and Tailwind fallback colors swap to canvas-extracted team colors. There is no unified "data ready" gate — each piece resolves independently and triggers its own visual update.

## Bug Analysis

### Current Behavior (Defect)

1.1 WHEN a sports card renders and team image data has not yet been fetched (no sessionStorage cache) THEN the system displays a letter/league-logo fallback that visibly swaps to the real team logo once the Gamma `/teams` API responds

1.2 WHEN a sports card renders and the Gamma `/teams` API has not yet responded THEN the system displays slug-parsed abbreviations (e.g. "CLE", "LAL") as button labels that are later replaced by API-provided abbreviations, causing a text content swap

1.3 WHEN a sports card renders and team logo URLs have not yet resolved THEN the system displays Tailwind fallback button colors (`bg-positive/10`, `text-positive` / `bg-negative/10`, `text-negative`) that visibly jump to canvas-extracted team-specific inline colors once the logo loads and color extraction completes

1.4 WHEN a sports card renders and the color extraction pipeline completes THEN the system applies inline `style={{ backgroundColor, color }}` that overrides the existing Tailwind classes, causing a visible color flash from green/red to team-specific hues

1.5 WHEN a user navigates to the Sports tab or filters by a league tag (triggering a fresh batch of cards with no cached data) THEN the system renders all cards simultaneously in their fallback state and they cascade through intermediate visual states sequentially, producing a wave of layout shifts across the grid

### Expected Behavior (Correct)

2.1 WHEN a sports card renders and team image data has not yet been fetched THEN the system SHALL display a cohesive loading skeleton (or hold rendering of image/color-dependent elements) until the team image URL is available, preventing a visible logo swap

2.2 WHEN a sports card renders and the Gamma `/teams` API has not yet responded THEN the system SHALL either use slug-parsed abbreviations as the stable final label (no swap) OR withhold button label rendering until the API responds, preventing text content replacement

2.3 WHEN a sports card renders and team colors have not yet been extracted THEN the system SHALL use a consistent neutral/skeleton appearance for buttons until colors are ready, preventing a visible color flash from fallback to team-specific colors

2.4 WHEN team color extraction completes THEN the system SHALL apply the final colors in a single atomic visual update (or with a subtle CSS transition) rather than an abrupt inline style override that causes a jarring flash

2.5 WHEN a user navigates to the Sports tab or filters by a league tag THEN the system SHALL render cards in a visually stable state from the first paint — either fully loaded (if cached) or in a uniform skeleton/placeholder state that transitions once to the final appearance

### Unchanged Behavior (Regression Prevention)

3.1 WHEN team image data is already available in sessionStorage cache THEN the system SHALL CONTINUE TO render cards instantly with correct logos, labels, and colors without any loading state

3.2 WHEN a non-sports event card renders (binary or multi-outcome) THEN the system SHALL CONTINUE TO render with its current behavior unaffected by sports card loading changes

3.3 WHEN the Gamma `/teams` API returns data THEN the system SHALL CONTINUE TO cache it in sessionStorage with 7-day staleTime so subsequent visits load instantly

3.4 WHEN team color palettes have been extracted and cached (module-level Map + sessionStorage) THEN the system SHALL CONTINUE TO apply them synchronously on subsequent renders without re-extraction

3.5 WHEN slug-parsed abbreviations are available synchronously THEN the system SHALL CONTINUE TO use them as the primary button label source (they match Polymarket's display format and are correct for most leagues)

3.6 WHEN the card is in the Explore grid with batched team image fetching THEN the system SHALL CONTINUE TO use the parent-provided batched data rather than per-card API calls

---

## Bug Condition (Formal)

```pascal
FUNCTION isBugCondition(X)
  INPUT: X of type SportsCardRenderContext
  OUTPUT: boolean

  // The bug triggers when a sports card renders without cached team data
  RETURN X.isSportsEvent = true
    AND (X.teamImagesCached = false OR X.teamColorsCached = false)
END FUNCTION
```

```pascal
// Property: Fix Checking — No Cascading Visual Shifts
FOR ALL X WHERE isBugCondition(X) DO
  renderedStates ← observeRenderStates(EventCard'(X))
  ASSERT countVisualStateChanges(renderedStates) ≤ 1
    // Card transitions at most once: skeleton/placeholder → final state
  ASSERT noIntermediateContentSwaps(renderedStates)
    // No logo swap, no label swap, no color flash
END FOR
```

```pascal
// Property: Preservation Checking — Cached Data Still Instant
FOR ALL X WHERE NOT isBugCondition(X) DO
  ASSERT EventCard(X) = EventCard'(X)
    // Cards with cached data render identically before and after the fix
END FOR
```
