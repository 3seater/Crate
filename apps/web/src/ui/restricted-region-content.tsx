import { POLYMARKET_GEOBLOCK_DOCS_URL } from "@doji/types";
import Link from "next/link";

/**
 * Shared content for restricted-region messaging: message + Available regions link.
 * Used by RestrictedRegionButton hover and RestrictedRegionDepositWithdrawButton hover.
 */
export function RestrictedRegionContent({
  className,
  linkClassName,
}: {
  className?: string;
  linkClassName?: string;
}) {
  return (
    <div className={className}>
      <p className="text-text-primary text-xs">
        Trading is not available in your region.
      </p>
      <Link
        className={
          linkClassName ??
          "mt-2 font-medium text-positive text-xs underline underline-offset-2 transition-colors hover:text-positive/90"
        }
        href={POLYMARKET_GEOBLOCK_DOCS_URL}
        rel="noopener noreferrer"
        target="_blank"
      >
        Available regions
      </Link>
    </div>
  );
}
