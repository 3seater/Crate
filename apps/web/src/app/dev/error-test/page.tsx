import type { Route } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  DEV_ERROR_QUERY_PARAM,
  isDevErrorBoundaryTestEnabled,
  withDevErrorQuery,
} from "@/lib/dev/dev-error-boundary-test";
import { buttonVariants } from "@/ui/button";
import { cn } from "@/utils/cn";

const ROUTE_EXAMPLES: { href: Route | string; label: string }[] = [
  { href: "/explore", label: "Explore" },
  { href: "/portfolio", label: "Portfolio" },
  { href: "/leaderboard", label: "Leaderboard" },
  { href: "/watchlist", label: "Watchlist" },
  { href: "/wallet-tracker", label: "Wallet tracker" },
  { href: "/referrals", label: "Referrals" },
  { href: "/login", label: "Login" },
  { href: "/login/callback", label: "Login callback" },
  /** Replace with a real `/market/[slug]` when testing. */
  { href: "/market/example-slug", label: "Market (edit slug in page)" },
  { href: "/", label: "Home (redirects)" },
];

/**
 * Dev-only hub: links that append `?__throw=1` to trigger server-side test errors.
 * Client render path: `/login?__throw=client` (and other routes with `DevErrorThrowClient`).
 */
export default function DevErrorTestPage() {
  if (!isDevErrorBoundaryTestEnabled()) {
    notFound();
  }

  return (
    <div className="mx-auto flex max-w-lg flex-col gap-6 p-8">
      <div className="flex flex-col gap-1">
        <h1 className="font-medium text-lg text-text-primary">
          Error boundary tests
        </h1>
        <p className="text-sm text-text-secondary">
          Development only. Each link adds{" "}
          <code className="rounded bg-surface-2 px-1 py-0.5 font-mono text-text-primary text-xs">
            ?{DEV_ERROR_QUERY_PARAM}=1
          </code>{" "}
          so the route&apos;s server component throws and the nearest{" "}
          <code className="font-mono text-xs">error.tsx</code> runs.
        </p>
      </div>

      <div className="flex flex-col gap-2">
        <p className="text-text-tertiary text-xs">Server throw (per route)</p>
        <ul className="flex flex-col gap-2">
          {ROUTE_EXAMPLES.map(({ href, label }) => (
            <li key={href}>
              <Link
                className={cn(
                  buttonVariants({ size: "sm", variant: "outline" })
                )}
                href={withDevErrorQuery(href) as Route}
              >
                {label}
              </Link>
            </li>
          ))}
        </ul>
      </div>

      <div className="flex flex-col gap-2 border-border-subtle border-t pt-4">
        <p className="text-text-tertiary text-xs">Client throw (login shell)</p>
        <Link
          className={cn(buttonVariants({ size: "sm", variant: "outline" }))}
          href={`/login?${DEV_ERROR_QUERY_PARAM}=client` as Route}
        >
          Login — client render throw
        </Link>
      </div>

      <p className="text-text-muted text-xs">
        Remove the query param or use Try again after fixing. Production builds
        ignore throws from this helper.
      </p>
    </div>
  );
}
