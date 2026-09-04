import type { ReactNode } from "react";

export function Shortcut({ children }: { children: ReactNode }) {
  return (
    <kbd className="inline-flex h-5 select-none items-center gap-1 rounded border border-primary/20 bg-fd-secondary px-1.5 font-medium font-mono text-[10px] text-primary opacity-100">
      {children}
    </kbd>
  );
}
