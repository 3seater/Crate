# Bugfix Requirements Document

## Introduction

The position badges displayed next to commenter names in the Comments tab have multiple issues that cause incorrect data display and missing functionality compared to Polymarket's reference implementation. Specifically: (1) position sizes show absurdly large numbers because `formatPositionSize` incorrectly divides by 10^6 when the Gamma API already returns human-readable share counts, (2) badges for positions in non-current markets within the same event show no market name label, and (3) there is no dropdown to view all of a commenter's holdings across the event (Polymarket shows the largest holding as the primary badge with a chevron that expands to show all positions).

## Bug Analysis

### Current Behavior (Defect)

1.1 WHEN a commenter holds a position and the Gamma API returns `positionSize` as a human-readable share count (e.g. "354821" meaning ~354.8K shares) THEN the system divides by 10^6 and displays a nonsensical value like "354821.4M" or "0" for small positions

1.2 WHEN a commenter holds a position in a different market within the same event (tokenId does not match the current market's yes/no token IDs) THEN the system displays a badge with only a formatted number and no market name label, making it impossible to identify which market the position belongs to

1.3 WHEN a commenter holds positions in multiple markets across the event THEN the system only shows the first non-null position as a fallback badge with no way to view all holdings

1.4 WHEN a commenter has multiple positions across the event THEN the system does not display the largest position as the primary badge (it shows the first one found regardless of size)

### Expected Behavior (Correct)

2.1 WHEN a commenter holds a position and the Gamma API returns `positionSize` as a human-readable share count THEN the system SHALL format the raw number directly without dividing by 10^6, displaying values like "354.8K", "10.0K", "395", or "56" using compact notation (≥1M → "1.2M", ≥1K → "354.8K", <1K → "56")

2.2 WHEN a commenter holds a position in a different market within the same event THEN the system SHALL resolve the tokenId to the corresponding market name (via the event's markets data mapping tokenId → market groupItemTitle/question) and display it alongside the position size (e.g. "354.8K Chris Murphy")

2.3 WHEN a commenter holds positions in multiple markets across the event THEN the system SHALL display the largest position as the primary badge and provide a clickable chevron that reveals a dropdown listing ALL positions sorted by size (largest first)

2.4 WHEN the user clicks the chevron on a position badge THEN the system SHALL show a dropdown where each row displays: market name, position size, and a "Yes"/"No" outcome pill indicating the side of the position

### Unchanged Behavior (Regression Prevention)

3.1 WHEN a commenter holds a position in the current market (tokenId matches yes or no token ID) THEN the system SHALL CONTINUE TO display the position badge with the correct outcome label and color coding (green for Yes-side, red for No-side in binary markets, grey for non-binary No-side)

3.2 WHEN a commenter has no positions (empty positions array or all null tokenIds) THEN the system SHALL CONTINUE TO show no badge

3.3 WHEN a commenter holds a position with size zero or negative THEN the system SHALL CONTINUE TO show no badge

3.4 WHEN the badge is displayed for a current-market position THEN the system SHALL CONTINUE TO use the existing color logic (green for Yes-side, red for No-side in binary, grey for non-binary No-side)

---

## Bug Condition (Formal)

### Bug Condition Function — Position Size Formatting (Bug 1)

```pascal
FUNCTION isBugCondition_Formatting(X)
  INPUT: X of type { positionSize: string }
  OUTPUT: boolean

  // The bug triggers for ALL position sizes because the division by 10^6 is
  // unconditionally applied. The API returns human-readable share counts,
  // not micro-units.
  RETURN X.positionSize IS NOT NULL AND Number(X.positionSize) > 0
END FUNCTION
```

### Property: Fix Checking — Position Size Formatting

```pascal
// Property: Fix Checking - Correct formatting without 10^6 division
FOR ALL X WHERE isBugCondition_Formatting(X) DO
  result ← formatPositionSize'(Number(X.positionSize))
  size = Number(X.positionSize)
  IF size >= 1_000_000 THEN
    ASSERT result matches /^\d+(\.\d)?M$/
  ELSE IF size >= 1_000 THEN
    ASSERT result matches /^\d+(\.\d)?K$/
  ELSE
    ASSERT result matches /^\d+$/
  END IF
END FOR
```

### Bug Condition Function — Missing Market Name (Bug 2)

```pascal
FUNCTION isBugCondition_MarketName(X)
  INPUT: X of type { position: CommentPosition, currentYesTokenId: string, currentNoTokenId: string }
  OUTPUT: boolean

  // Bug triggers when position is in a different market (not current market's tokens)
  RETURN X.position.tokenId ≠ X.currentYesTokenId
     AND X.position.tokenId ≠ X.currentNoTokenId
     AND X.position.tokenId IS NOT NULL
     AND Number(X.position.positionSize) > 0
END FUNCTION
```

### Property: Fix Checking — Market Name Resolution

```pascal
// Property: Fix Checking - Non-current-market positions show market name
FOR ALL X WHERE isBugCondition_MarketName(X) DO
  badge ← renderPositionBadge'(X)
  ASSERT badge.label CONTAINS resolvedMarketName(X.position.tokenId)
END FOR
```

### Preservation Goal

```pascal
// Property: Preservation Checking - Current market positions unchanged
FOR ALL X WHERE NOT isBugCondition_MarketName(X) DO
  ASSERT renderPositionBadge(X) = renderPositionBadge'(X)
END FOR
```
