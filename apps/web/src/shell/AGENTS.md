# Shell

> Scope: `apps/web/src/shell/` — app shell, header, navigation, dock panels, widgets.

## Conventions

### Animation (Framer Motion)

- `providers.tsx` wraps the app in `<LazyMotion features={domAnimation} strict>` — this tree-shakes ~30kb of unused animation code.
- **Always import `m` (not `motion`)** from `framer-motion` in layout and widget files. `m` is the LazyMotion-compatible component; `motion` bypasses LazyMotion and re-bundles the full library.
- `AnimatePresence` works with `m` — no changes needed for enter/exit animations.

### Providers Lazy-Loading

- `V2ApprovalMigrationModal` is lazy-loaded via `React.lazy()` — it pulls in bridge + trading deps (~30-50KB) that most users never need.
- `magic-sdk` is dynamically imported inside `MagicProvider`'s `useEffect` alongside `@magic-ext/oauth2` — both load async after mount (~180KB deferred from initial bundle).
- When adding new providers or modals to `providers.tsx`, prefer `React.lazy()` + `<Suspense>` for anything not needed on first render.

## Structure

```
layout/
├── providers.tsx          # Root providers (QueryClient, Magic, modals, theme, toast)
├── app-shell.tsx          # Server Component shell
├── app-shell-router.tsx   # Client-side router wrapper
├── chrome-visibility-router.tsx # Route-based chrome visibility (hides header/dock on login)
├── site-header.tsx        # Header composition
├── header-nav.tsx         # Navigation links
├── header-actions.tsx     # Wallet balance, notifications, user menu
├── header-search.tsx      # Header search trigger
├── header-wallet-balance.tsx # Wallet balance display
├── header-wrap-button.tsx   # USDC.e → pUSD wrap button (shows when pUSD balance is 0)
├── header-mobile-nav.tsx  # Mobile navigation drawer
├── header-control-styles.ts # Shared header control CSS classes
├── bottom-bar.tsx         # Fixed footer: dock toggles, social links, bug report, settings, status
├── bottom-bar-shell.tsx   # Bottom bar layout shell
├── bottom-bar-status-link.tsx # Bottom bar status indicator link
├── bug-report-widget.tsx  # "Report a bug" → dialog + POST /api/report-bug (Discord webhook); success counted server-side only via `trackWebEventOnServer` in the route handler
├── global-search.tsx      # Command palette (Ctrl+K)
├── global-search-utils.ts # Search helper functions
├── search-results.tsx     # Search results display
├── search-ends-cell.tsx   # Search result end-date cell
├── use-filtered-search.ts # Search filtering hook
├── content-width.tsx      # Content width wrapper (variants: full, narrow, etc.)
├── content-spacing.tsx    # Content vertical spacing wrapper
├── page-header.tsx        # Page header component
├── notifications-bell.tsx # Notification bell icon + dropdown (Vercel custom events, e.g. dismiss)
├── comments-context.tsx   # Comments context provider
├── top-loading-bar.tsx    # Route change loading indicator
├── dock-shell.tsx         # Dock panel container
├── dock-slot.tsx          # Individual dock slot
├── dock-resize-handle.tsx # Dock resize handle
├── dock-chrome-padding.ts # Dock chrome padding utility
├── responsive-sizing.ts   # Responsive sizing utilities
├── trading-settings-widget.tsx # Trading settings dock widget
├── watchlist-bar.tsx      # Watchlist bar component
├── stores/
│   └── dock-layout.ts     # Dock panel visibility + width state
├── hooks/
│   └── use-global-activity-feed.ts  # Global trade activity via RTDS
└── widgets/
    ├── activity-widget.tsx          # Activity feed dock widget
    ├── activity-widget-content.tsx  # Activity feed content
    ├── calendar-widget.tsx          # Calendar dock widget
    ├── portfolio-widget.tsx         # Portfolio dock widget (positions + orders)
    ├── portfolio-widget-content.tsx # Portfolio split content (live prices via market channel)
    ├── widget-dock-controls.tsx     # Dock/undock controls
```
