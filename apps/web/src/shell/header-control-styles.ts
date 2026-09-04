/** Shared layout for SiteHeader controls — height from `--header-control-height`; surfaces use theme tokens only */
export const headerControlHeightClass = "h-[var(--header-control-height)]";

/**
 * Main nav link chrome (Home, Crates) — single source for
 * inactive text + hover (inactive uses secondary text color; active route is orange).
 */
export const headerNavLinkBaseClass =
  "px-3 py-1 text-sm font-normal transition-colors duration-150";
export const headerNavLinkInactiveClass =
  "text-[color:var(--text-secondary)] hover:text-[color:var(--text-primary)]";
export const headerNavLinkActiveClass =
  "text-[color:var(--crate-orange)] [text-decoration:underline] [text-decoration-color:var(--crate-orange)] [text-underline-offset:2px]";
