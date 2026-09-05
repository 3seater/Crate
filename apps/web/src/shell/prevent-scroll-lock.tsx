"use client";

import { useEffect } from "react";

/**
 * Blocks RainbowKit (and any other library) from injecting
 * padding-right + overflow:hidden on <body> when a modal opens,
 * which causes the floating nav to shift.
 *
 * We intercept the style property setter and ignore writes to
 * `paddingRight` and `overflow` on document.body.
 */
export function PreventScrollLock() {
  useEffect(() => {
    const bodyStyle = document.body.style;
    const proto = Object.getPrototypeOf(bodyStyle);

    const makeSafeDescriptor = (prop: string) => {
      const original = Object.getOwnPropertyDescriptor(proto, prop);
      if (!original?.set) return;
      Object.defineProperty(bodyStyle, prop, {
        get: original.get?.bind(bodyStyle),
        set: (_value: string) => {
          // silently block padding-right and overflow changes on body
        },
        configurable: true,
      });
    };

    makeSafeDescriptor("paddingRight");
    makeSafeDescriptor("overflow");

    return () => {
      // Restore originals on unmount
      delete (bodyStyle as unknown as Record<string, unknown>).paddingRight;
      delete (bodyStyle as unknown as Record<string, unknown>).overflow;
    };
  }, []);

  return null;
}
