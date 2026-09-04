import { Suspense } from "react";
import { AppShellRouter } from "@/shell/app-shell-router";
import { BottomBar } from "@/shell/bottom-bar";
import { BottomBarShell } from "@/shell/bottom-bar-shell";
import { SiteHeader } from "@/shell/site-header";

const mainChrome = "flex min-h-0 min-w-0 flex-1 flex-col bg-surface-0 px-4";

/**
 * Static fallback for the main content area while AppShellRouter hydrates.
 * Header, watchlist bar, and bottom bar render outside Suspense so they
 * are always present in the initial HTML — zero flash on hard refresh.
 *
 * Mirrors DockShell + AppShellRouter structure: an outer flex wrapper with
 * overflow-hidden (same role as DockShell) and a main with overflow-y-hidden
 * so flex-1 children are height-constrained — matching the hydrated layout.
 */
function AppShellFallback({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-0 flex-1 overflow-hidden">
      <main
        className={`${mainChrome} overflow-y-hidden overflow-x-visible pb-8`}
      >
        {children}
      </main>
    </div>
  );
}

/**
 * Chrome visibility wrapper — hides header/watchlist/footer on login/landing.
 * Uses a client component that reads pathname, but the chrome itself renders
 * in the static HTML so it never flashes on routes that show it.
 */
function ChromeVisibility({ children }: { children: React.ReactNode }) {
  return (
    <Suspense fallback={children}>
      <ChromeVisibilityRouter>{children}</ChromeVisibilityRouter>
    </Suspense>
  );
}

/**
 * Lazy import to keep the client boundary small — only needed for pathname check.
 * Falls back to showing chrome (the common case).
 */
import { ChromeVisibilityRouter } from "@/shell/chrome-visibility-router";

/**
 * Desktop-only chrome (header, watchlist, bottom bar + widget strip).
 * Matches `/login` mobile messaging (`lg` = 1024px): below that width we do not
 * ship the trading shell; pathname-based hiding alone is not enough because
 * Suspense fallbacks (e.g. `BottomBarShell`) can still paint on refresh.
 */
const desktopChromeWrapperClass = "hidden w-full shrink-0 lg:block";

export function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex h-svh min-h-0 min-w-0 flex-col overflow-y-hidden overflow-x-visible">
      <div className={desktopChromeWrapperClass}>
        <ChromeVisibility>
          <SiteHeader />
        </ChromeVisibility>
      </div>
      <Suspense fallback={<AppShellFallback>{children}</AppShellFallback>}>
        <AppShellRouter>{children}</AppShellRouter>
      </Suspense>
      <div className={desktopChromeWrapperClass}>
        <ChromeVisibility>
          <Suspense fallback={<BottomBarShell />}>
            <BottomBar />
          </Suspense>
        </ChromeVisibility>
      </div>
    </div>
  );
}
