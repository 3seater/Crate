/**
 * Geoblock types for Polymarket geographic restrictions
 * @see https://docs.polymarket.com/developers/CLOB/geoblock
 */

/**
 * Response from Polymarket's geoblock endpoint
 * GET https://polymarket.com/api/geoblock
 */
export interface GeoblockResponse {
  /** Whether the user is blocked from placing orders */
  blocked: boolean;
  /** ISO 3166-1 alpha-2 country code */
  country: string;
  /** Detected IP address */
  ip: string;
  /** Region/state code */
  region: string;
}

/**
 * Extended geoblock result with error handling
 * Used internally to distinguish API failures from blocked status
 */
export interface GeoblockResult extends GeoblockResponse {
  /**
   * True when the geoblock check failed due to a network error or non-OK
   * response. Used to distinguish "API said not blocked" from "we couldn't
   * reach the API". When true, read-only browsing is allowed (fail-open)
   * but trading is blocked (fail-closed).
   */
  checkFailed: boolean;
}

/**
 * Countries fully blocked from trading on Polymarket.
 * @see https://docs.polymarket.com/api-reference/geoblock#blocked-countries
 */
export const BLOCKED_COUNTRIES = new Set([
  "AU",
  "BE",
  "BY",
  "BI",
  "CF",
  "CD",
  "CU",
  "DE",
  "ET",
  "FR",
  "GB",
  "IR",
  "IQ",
  "IT",
  "KP",
  "LB",
  "LY",
  "MM",
  "NI",
  "NL",
  "RU",
  "SO",
  "SS",
  "SD",
  "SY",
  "UM",
  "US",
  "VE",
  "YE",
  "ZW",
]);

/**
 * Countries in close-only mode (can close positions but not open new ones).
 * Treated as blocked for new order placement.
 * @see https://docs.polymarket.com/api-reference/geoblock#blocked-countries
 */
export const CLOSE_ONLY_COUNTRIES = new Set(["PL", "SG", "TH", "TW"]);

/**
 * Specific regions blocked within otherwise accessible countries.
 * Key: country code, Value: set of blocked region codes.
 * @see https://docs.polymarket.com/api-reference/geoblock#blocked-regions
 */
export const BLOCKED_REGIONS: ReadonlyMap<
  string,
  ReadonlySet<string>
> = new Map([
  ["CA", new Set(["ON"])],
  ["UA", new Set(["43", "14", "09"])],
]);

/** Check if a country + region combination is blocked. */
export function isGeoBlocked(country: string, region: string): boolean {
  if (BLOCKED_COUNTRIES.has(country) || CLOSE_ONLY_COUNTRIES.has(country)) {
    return true;
  }
  return BLOCKED_REGIONS.get(country)?.has(region) ?? false;
}
