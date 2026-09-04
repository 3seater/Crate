"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/utils/cn";
import {
  headerNavLinkActiveClass,
  headerNavLinkBaseClass,
  headerNavLinkInactiveClass,
} from "./header-control-styles";

const NAV_LINKS = [
  { href: "/", label: "Home" },
  { href: "/crates", label: "Crates" },
] as const;

/** Client island: nav links with active-route highlighting. Must be inside Suspense. */
export function HeaderNav() {
  const pathname = usePathname();
  return (
    <nav aria-label="Main navigation">
      <ul className="flex items-center gap-1">
        {NAV_LINKS.map(({ href, label }) => {
          const isActive =
            href === "/" ? pathname === "/" : pathname.startsWith(href);
          return (
            <li key={href}>
              <Link
                aria-current={isActive ? "page" : undefined}
                className={cn(
                  headerNavLinkBaseClass,
                  isActive
                    ? headerNavLinkActiveClass
                    : headerNavLinkInactiveClass
                )}
                href={href}
              >
                {label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

/** Static nav links without active highlighting — used as Suspense fallback. */
export function HeaderNavFallback() {
  return (
    <nav aria-label="Main navigation">
      <ul className="flex items-center gap-1">
        {NAV_LINKS.map(({ href, label }) => (
          <li key={href}>
            <Link
              className={cn(headerNavLinkBaseClass, headerNavLinkInactiveClass)}
              href={href}
            >
              {label}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}
