"use client";

import { useEffect } from "react";
import { useDockLayoutStore } from "@/shell/stores/dock-layout";
import { DockSlot } from "./dock-slot";

const mainChrome = "flex min-h-0 min-w-0 flex-1 flex-col bg-surface-0 px-4";

interface DockShellProps {
  children: React.ReactNode;
  mainClassName?: string;
}

export function DockShell({ children, mainClassName }: DockShellProps) {
  // Granular selectors — only re-render when the specific slot or its width changes
  const leftSlot = useDockLayoutStore((s) => s.leftSlot);
  const rightSlot = useDockLayoutStore((s) => s.rightSlot);
  const leftWidth = useDockLayoutStore((s) =>
    s.leftSlot ? s.widths[s.leftSlot] : 0
  );
  const rightWidth = useDockLayoutStore((s) =>
    s.rightSlot ? s.widths[s.rightSlot] : 0
  );
  const syncToViewport = useDockLayoutStore((s) => s.syncToViewport);

  // Rehydrate after successful hydration to avoid hydration mismatch with SSR.
  // The store uses skipHydration:true so the server and client first renders both
  // start with no dock panels (matching). Panels then appear after mount.
  useEffect(() => {
    useDockLayoutStore.persist.rehydrate();
    const id = window.setTimeout(() => syncToViewport(), 0);
    return () => window.clearTimeout(id);
  }, [syncToViewport]);

  // Sync CSS vars and re-normalize active slot widths on resize.
  useEffect(() => {
    document.documentElement.style.setProperty(
      "--dock-left-width",
      leftSlot ? `${leftWidth}px` : "0px"
    );
  }, [leftSlot, leftWidth]);

  useEffect(() => {
    document.documentElement.style.setProperty(
      "--dock-right-width",
      rightSlot ? `${rightWidth}px` : "0px"
    );
  }, [rightSlot, rightWidth]);

  useEffect(() => {
    const onResize = () => syncToViewport();
    window.addEventListener("resize", onResize, { passive: true });
    return () => window.removeEventListener("resize", onResize);
  }, [syncToViewport]);

  return (
    <div className="flex min-h-0 flex-1 overflow-hidden">
      <DockSlot side="left" />
      <main
        className={`${mainChrome}${mainClassName ? ` ${mainClassName}` : ""}`}
      >
        {children}
      </main>
      <DockSlot side="right" />
    </div>
  );
}
