import { BottomBarStatusLink } from "@/shell/bottom-bar-status-link";
import { BugReportWidget } from "@/shell/bug-report-widget";

export function BottomBar() {
  return (
    <footer className="fixed right-0 bottom-0 left-0 z-30 flex h-8 shrink-0 items-center justify-end border-[color:var(--border-default)] border-t bg-[color:var(--bg-base)] px-4">
      <div className="flex shrink-0 items-center gap-2">
        <BugReportWidget />
        <BottomBarStatusLink />
      </div>
    </footer>
  );
}
