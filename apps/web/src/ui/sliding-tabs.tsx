"use client";

import { useSlidingTabIndicator } from "@/hooks/use-sliding-tab-indicator";
import { cn } from "@/utils/cn";

type TabItem = string | { value: string; label: string };

export interface SlidingTabsProps {
  activeTab: string;
  /** Class for the tab row (overrides defaults). Default: flex h-16 items-center gap-6 border-border border-b px-6 */
  className?: string;
  /** Optional count or badge to render after each tab label */
  getTabBadge?: (tab: string) => React.ReactNode;
  onTabChange: (tab: string) => void;
  /** Class for individual tab buttons (overrides defaults). */
  tabClassName?: string;
  tabs: readonly TabItem[];
}

function normalizeTab(tab: TabItem): { value: string; label: string } {
  return typeof tab === "string" ? { value: tab, label: tab } : tab;
}

/**
 * Horizontal tabs with a sliding green underline that animates when switching.
 * Use for Wallets/Trades, Active Referrals/Live Trades, etc.
 * Excluded from trading menu (Buy/Sell, Market/Limit/Split/Merge).
 */
export function SlidingTabs({
  tabs,
  activeTab,
  onTabChange,
  getTabBadge,
  className,
  tabClassName,
}: SlidingTabsProps) {
  const tabValues = tabs.map((t) => normalizeTab(t).value);
  const { containerRef, setTabRef, indicator } = useSlidingTabIndicator(
    tabValues,
    activeTab
  );

  return (
    <div
      className={cn(
        "relative flex h-16 items-center gap-6 border-border border-b px-6",
        className
      )}
      ref={containerRef}
    >
      {tabs.map((tab) => {
        const { value, label } = normalizeTab(tab);
        return (
          <button
            className={cn(
              "relative h-auto cursor-pointer border-none bg-transparent px-0 py-3 font-medium text-sm transition-colors",
              activeTab === value
                ? "text-text-primary"
                : "text-muted-foreground hover:text-text-primary",
              tabClassName
            )}
            key={value}
            onClick={() => onTabChange(value)}
            ref={setTabRef(value)}
            type="button"
          >
            {label}
            {getTabBadge?.(value)}
          </button>
        );
      })}
      {indicator != null && (
        <div
          aria-hidden
          className="absolute bottom-0 h-0.5 bg-primary transition-[left,width] duration-200 ease-out"
          style={{
            left: indicator.left,
            width: indicator.width,
          }}
        />
      )}
    </div>
  );
}
