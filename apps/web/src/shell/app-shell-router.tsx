"use client";

import { usePathname } from "next/navigation";
import { DockShell } from "@/shell/dock-shell";

/**
 * Route-aware content shell. Header and bottom bar are rendered by AppShell
 * outside Suspense so they never flash on hard refresh.
 * This component wraps content in the DockShell.
 */
export function AppShellRouter({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isCratePage = pathname?.startsWith("/crates/");

  let mainScrollClass = "overflow-auto overflow-x-hidden";
  if (isCratePage) {
    mainScrollClass = "overflow-y-hidden overflow-x-visible !px-0";
  }

  return (
    <DockShell mainClassName={`pb-8 ${mainScrollClass}`}>{children}</DockShell>
  );
}
