/**
 * Common types shared across Polymarket APIs
 */

/**
 * Standard error response
 */
export interface ErrorResponse {
  error: string;
}

/**
 * Health check response
 */
export interface HealthResponse {
  data: string;
}

/**
 * Pagination metadata
 */
export interface Pagination {
  hasMore: boolean;
  totalResults: number;
}
