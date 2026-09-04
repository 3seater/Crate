import {
  Activity,
  Calendar as CalendarIcon,
  FileText,
  Settings,
  Star,
  Wallet,
} from "lucide-react";
import { DiscordIcon } from "@/ui/discord-icon";
import { Separator } from "@/ui/separator";
import { XIcon } from "@/ui/x-icon";

const toggleBase =
  "inline-flex items-center gap-1.5 rounded-md border-0 bg-transparent px-2 py-1 font-medium text-xs text-muted-foreground shadow-none";
const iconClass = "h-3.5 w-3.5";

/**
 * Static bottom bar shell — renders the same footer chrome as BottomBar
 * but without any interactive state or widgets. Used as the Suspense
 * fallback so the footer is always visible in the initial HTML.
 */
export function BottomBarShell() {
  return (
    <footer className="fixed right-0 bottom-0 left-0 z-30 flex h-8 shrink-0 items-center justify-between border-border border-t bg-background px-4">
      <div className="flex min-w-0 items-center">
        <span className={toggleBase}>
          <Wallet className={iconClass} />
          <span>Wallet Tracker</span>
        </span>
        <Separator
          aria-hidden
          className="self-stretch"
          orientation="vertical"
        />
        <span className={toggleBase}>
          <Star className={iconClass} />
          <span>Watchlist</span>
        </span>
        <Separator
          aria-hidden
          className="self-stretch"
          orientation="vertical"
        />
        <span className={toggleBase}>
          <CalendarIcon className={iconClass} />
          <span>Calendar</span>
        </span>
        <Separator
          aria-hidden
          className="self-stretch"
          orientation="vertical"
        />
        <span className={toggleBase}>
          <Activity className={iconClass} />
          <span>Activity</span>
        </span>
      </div>
      <div className="flex shrink-0 items-center gap-2">
        <div className="flex items-center gap-2 text-muted-foreground">
          <XIcon className="h-3.5 w-3.5" />
          <DiscordIcon className="h-3.5 w-3.5" />
          <FileText className="h-3.5 w-3.5" />
        </div>
        <Separator
          aria-hidden
          className="self-stretch"
          orientation="vertical"
        />
        <span className={toggleBase}>
          <Settings className={iconClass} />
          <span>Settings</span>
        </span>
      </div>
    </footer>
  );
}
