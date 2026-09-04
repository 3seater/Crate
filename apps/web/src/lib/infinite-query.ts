/**
 * Offset pagination when the API returns a plain array (no `hasMore`).
 * Same rule as market TradesTab / wallet tracker activity.
 */
export function getNextPageParamForArrayPage<T>(
  pageSize: number,
  lastPage: T[],
  allPages: T[][]
): number | undefined {
  if (lastPage.length < pageSize) {
    return;
  }
  return allPages.reduce((sum, p) => sum + p.length, 0);
}
