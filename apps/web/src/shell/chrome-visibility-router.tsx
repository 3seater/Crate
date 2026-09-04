"use client";

/**
 * Wraps shell chrome (header/footer) for route-based visibility.
 * In the basket terminal there are no routes that hide chrome,
 * so this always renders children.
 */
export function ChromeVisibilityRouter({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
