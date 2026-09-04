import Link from "next/link";
import { Suspense } from "react";
import { HeaderActions } from "./header-actions";
import { HeaderMobileNav } from "./header-mobile-nav";
import { HeaderNav, HeaderNavFallback } from "./header-nav";

/** Inline Crate wordmark — box SVG icon + logotype text. */
function CrateWordmark() {
  return (
    <span className="flex items-center gap-1.5">
      {/* Box icon — purely decorative */}
      <svg
        aria-hidden="true"
        fill="none"
        height="18"
        viewBox="0 0 18 18"
        width="18"
      >
        <rect
          height="14"
          rx="0"
          stroke="currentColor"
          strokeWidth="1.5"
          width="14"
          x="2"
          y="2"
        />
        <line
          stroke="currentColor"
          strokeWidth="1.5"
          x1="2"
          x2="16"
          y1="7"
          y2="7"
        />
      </svg>
      <span className="font-medium text-[color:var(--text-primary)] text-sm">
        Crate
      </span>
    </span>
  );
}

/**
 * Server-rendered site header. Static markup (wordmark, nav links) is in the
 * initial HTML. Client islands handle interactive/data-dependent parts.
 */
export function SiteHeader() {
  return (
    <header className="sticky top-0 z-40 w-full border-[color:var(--border-default)] border-b bg-[color:var(--bg-base)]">
      {/* Desktop: 3-column grid — logo | nav | actions */}
      <div className="hidden h-12 grid-cols-[auto_1fr_auto] items-center gap-x-4 px-4 py-2 lg:grid">
        <Link className="-ml-1 flex shrink-0 items-center rounded p-1" href="/">
          <CrateWordmark />
        </Link>
        <div className="ml-6 flex min-w-0 items-center">
          <Suspense fallback={<HeaderNavFallback />}>
            <HeaderNav />
          </Suspense>
        </div>
        <div className="flex items-center justify-end gap-4">
          <HeaderActions />
        </div>
      </div>

      {/* Mobile: flex with hamburger */}
      <div className="flex h-11 items-center justify-between gap-4 px-4 lg:hidden">
        <div className="flex items-center gap-4">
          <Link
            className="-ml-1 flex shrink-0 items-center rounded p-1"
            href="/"
          >
            <CrateWordmark />
          </Link>
          <HeaderMobileNav />
        </div>
        <div className="flex items-center gap-4">
          <HeaderActions />
        </div>
      </div>
    </header>
  );
}
