import { ChevronLeft } from "lucide-react";
import Link from "next/link";

/**
 * Simple back navigation from a basket terminal to the baskets catalog.
 */
export function BasketSelector({
  activeBasketId: _,
}: {
  activeBasketId: string;
}) {
  return (
    <div>
      <Link
        className="-ml-1 inline-flex items-center gap-1 rounded-md px-2 py-1 text-sm text-text-secondary transition-colors hover:bg-[color:var(--bg-surface-raised)] hover:text-text-primary"
        href="/crates"
      >
        <ChevronLeft className="size-4" />
        All Crates
      </Link>
    </div>
  );
}
