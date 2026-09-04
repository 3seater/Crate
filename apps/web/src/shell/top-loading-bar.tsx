"use client";

import { usePathname } from "next/navigation";
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react";

/** Slow increment per tick when loading (never reaches 100% until done). */
const TRICKLE_RATE = 0.8;
const TRICKLE_INTERVAL_MS = 100;
const MAX_BEFORE_DONE = 90;
const RAMP_DURATION_MS = 200;
const FADE_DURATION_MS = 150;

function isInternalLink(element: HTMLElement): boolean {
  const anchor = element.closest("a");
  if (!anchor?.href) {
    return false;
  }
  try {
    const url = new URL(anchor.href);
    return (
      url.origin === window.location.origin &&
      url.pathname !== window.location.pathname
    );
  } catch {
    return false;
  }
}

export function TopLoadingBar() {
  const pathname = usePathname();
  const [progress, setProgress] = useState(0);
  const [isVisible, setIsVisible] = useState(false);
  const [isFading, setIsFading] = useState(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const rampRef = useRef<ReturnType<typeof requestAnimationFrame> | null>(null);
  const prevPathnameRef = useRef(pathname);
  const progressRef = useRef(0);

  useLayoutEffect(() => {
    progressRef.current = progress;
  }, [progress]);

  const stopTrickle = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  }, []);

  const start = useCallback(() => {
    stopTrickle();
    setProgress(0);
    setIsFading(false);
    setIsVisible(true);

    intervalRef.current = setInterval(() => {
      setProgress((p) => {
        const next = Math.min(p + TRICKLE_RATE, MAX_BEFORE_DONE);
        return next;
      });
    }, TRICKLE_INTERVAL_MS);
  }, [stopTrickle]);

  const done = useCallback(() => {
    stopTrickle();

    const startProgress = progressRef.current;
    const startTime = performance.now();

    const animate = (now: number) => {
      const elapsed = now - startTime;
      const t = Math.min(elapsed / RAMP_DURATION_MS, 1);
      const eased = 1 - (1 - t) ** 2;
      const next = startProgress + (100 - startProgress) * eased;
      setProgress(next);

      if (t < 1) {
        rampRef.current = requestAnimationFrame(animate);
      } else {
        setProgress(100);
        setIsFading(true);
        setTimeout(() => {
          setIsVisible(false);
          setIsFading(false);
          setProgress(0);
        }, FADE_DURATION_MS);
      }
    };

    rampRef.current = requestAnimationFrame(animate);
  }, [stopTrickle]);

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (isInternalLink(target)) {
        start();
      }
    };

    document.addEventListener("click", handleClick, true);
    return () => document.removeEventListener("click", handleClick, true);
  }, [start]);

  useEffect(() => {
    if (pathname !== prevPathnameRef.current) {
      prevPathnameRef.current = pathname;
      if (isVisible) {
        done();
      }
    }
  }, [pathname, isVisible, done]);

  useEffect(
    () => () => {
      stopTrickle();
      if (rampRef.current) {
        cancelAnimationFrame(rampRef.current);
      }
    },
    [stopTrickle]
  );

  if (!isVisible) {
    return null;
  }

  return (
    <div
      aria-hidden
      aria-valuemax={100}
      aria-valuemin={0}
      aria-valuenow={Math.round(progress)}
      className={`fixed top-0 right-0 left-0 z-9999 h-0.5 overflow-hidden transition-opacity ${
        isFading ? "opacity-0" : "opacity-100"
      }`}
      role="progressbar"
      style={{ transitionDuration: `${FADE_DURATION_MS}ms` }}
    >
      <div
        className="h-full rounded-r-full bg-doji-green transition-[width] duration-75 ease-out"
        style={{
          width: `${progress}%`,
          transitionProperty: progress >= MAX_BEFORE_DONE ? "width" : "none",
          transitionDuration:
            progress >= MAX_BEFORE_DONE ? `${RAMP_DURATION_MS}ms` : "75ms",
        }}
      />
    </div>
  );
}
