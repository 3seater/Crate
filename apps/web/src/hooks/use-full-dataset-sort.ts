"use client";

import { useEffect, useRef, useState } from "react";

interface UseFullDatasetSortOptions {
  /** The default sort field — fetch-all is skipped when sortField equals this */
  defaultSortField: string | null;
  /** From useInfiniteQuery */
  fetchNextPage: () => unknown;
  /** From useInfiniteQuery */
  hasNextPage: boolean;
  /** From useInfiniteQuery — stops the fetch loop on error */
  isError?: boolean;
  /** From useInfiniteQuery */
  isFetchingNextPage: boolean;
  /** When true, the server handles sorting — skip fetch-all */
  serverSortAvailable: boolean;
  /** Current sort field (null = no sort active) */
  sortField: string | null;
}

interface UseFullDatasetSortResult {
  /** True when all pages are loaded or no fetch-all is needed */
  allDataLoaded: boolean;
  /** True while the hook is actively fetching all pages for a sort */
  isFetchingForSort: boolean;
}

/**
 * Auto-fetches all remaining pages from an infinite query when a non-default
 * client-side sort is active. This ensures the sort comparator runs on the
 * complete dataset instead of only the pages loaded so far.
 *
 * Does NOT trigger fetch-all when:
 * - sortField is null
 * - sortField equals defaultSortField
 * - serverSortAvailable is true
 * - the query is in an error state
 */
export function useFullDatasetSort({
  fetchNextPage,
  hasNextPage,
  isFetchingNextPage,
  isError = false,
  sortField,
  defaultSortField,
  serverSortAvailable,
}: UseFullDatasetSortOptions): UseFullDatasetSortResult {
  const [isFetchingForSort, setIsFetchingForSort] = useState(false);
  const fetchLoopActiveRef = useRef(false);

  const needsFetchAll =
    sortField !== null &&
    sortField !== defaultSortField &&
    !serverSortAvailable;

  // Trigger fetch-all loop when conditions are met
  useEffect(() => {
    // Stop on error — don't keep hammering a failing API
    if (isError && fetchLoopActiveRef.current) {
      fetchLoopActiveRef.current = false;
      setIsFetchingForSort(false);
      return;
    }

    if (!(needsFetchAll && hasNextPage) || isFetchingNextPage || isError) {
      // If we were fetching and pages are now exhausted, stop
      if (fetchLoopActiveRef.current && !hasNextPage) {
        fetchLoopActiveRef.current = false;
        setIsFetchingForSort(false);
      }
      return;
    }

    // Start the fetch loop
    fetchLoopActiveRef.current = true;
    setIsFetchingForSort(true);
    fetchNextPage();
  }, [needsFetchAll, hasNextPage, isFetchingNextPage, isError, fetchNextPage]);

  // Reset state when sort changes back to default / server-side / null
  useEffect(() => {
    if (!needsFetchAll) {
      fetchLoopActiveRef.current = false;
      setIsFetchingForSort(false);
    }
  }, [needsFetchAll]);

  const allDataLoaded = !(needsFetchAll && hasNextPage);

  return { isFetchingForSort, allDataLoaded };
}
