"use client";

import Image from "next/image";
import { useLayoutEffect, useRef, useState } from "react";
import { cn } from "@/utils/cn";

const SIZE_CLASSES = {
  xs: "size-5",
  sm: "size-7",
  md: "size-12",
  lg: "size-16",
} as const;

export interface ImageWithFallbackProps {
  alt: string;
  className?: string;
  fallbackChar: string;
  fallbackSrc?: string | null;
  loading?: "eager";
  onDisplayReady?: () => void;
  preload?: boolean;
  /** `sm` suits tiny thumbnails (e.g. watchlist strip); `md` is default for list cards. */
  rounded?: "sm" | "md" | "full";
  size?: keyof typeof SIZE_CLASSES;
  src: string | null | undefined;
}

/**
 * Renders an image with fallback chain: src → fallbackSrc → skeleton while loading
 * → initial letter when nothing loads.
 * Single DOM structure on all paths — no hydration mismatches.
 */
export function ImageWithFallback({
  src,
  fallbackSrc,
  alt,
  size = "md",
  rounded = "md",
  loading,
  preload,
  className,
  onDisplayReady,
}: ImageWithFallbackProps) {
  "use no memo";

  const primary = typeof src === "string" && src.length > 0 ? src : null;
  const fallback =
    typeof fallbackSrc === "string" && fallbackSrc.length > 0
      ? fallbackSrc
      : null;
  const targetFromProps = primary ?? fallback ?? null;

  const [currentSrc, setCurrentSrc] = useState<string | null>(targetFromProps);
  const [showChar, setShowChar] = useState(!targetFromProps);
  const [imgLoaded, setImgLoaded] = useState(false);

  const prevPropsRef = useRef<{
    primary: string | null;
    fallback: string | null;
  } | null>(null);
  const lastLoadedUrlRef = useRef<string | null>(null);

  useLayoutEffect(() => {
    const prev = prevPropsRef.current;
    if (prev && prev.primary === primary && prev.fallback === fallback) {
      return;
    }
    prevPropsRef.current = { primary, fallback };

    const next = primary ?? fallback ?? null;
    setCurrentSrc(next);
    setShowChar(!next);

    if (!next) {
      setImgLoaded(false);
      lastLoadedUrlRef.current = null;
      return;
    }

    if (next === lastLoadedUrlRef.current) {
      setImgLoaded(true);
      return;
    }

    setImgLoaded(false);
    if (typeof window !== "undefined") {
      const probe = new window.Image();
      probe.src = next;
      if (probe.complete && probe.naturalWidth > 0) {
        setImgLoaded(true);
        lastLoadedUrlRef.current = next;
      }
    }
  }, [primary, fallback]);

  const effectiveSrc = currentSrc?.trim() || null;

  useLayoutEffect(() => {
    if (showChar || !effectiveSrc) {
      onDisplayReady?.();
    }
  }, [showChar, effectiveSrc, onDisplayReady]);

  const roundedClass =
    rounded === "full"
      ? "rounded-full"
      : // biome-ignore lint/style/noNestedTernary: readable three-way variant selection
        rounded === "sm"
        ? "rounded-sm"
        : "rounded-md";
  /** Letter fallback: no endless pulse when there is no image URL at all. */
  const showSkeleton = !(showChar || (effectiveSrc && imgLoaded));

  const SIZE_PX = { xs: 20, sm: 40, md: 48, lg: 64 } as const;

  return (
    <div
      className={cn("relative shrink-0", SIZE_CLASSES[size], className)}
      suppressHydrationWarning
    >
      {showSkeleton && (
        <div
          aria-hidden
          className={cn(
            "absolute inset-0 animate-pulse bg-muted",
            roundedClass
          )}
          suppressHydrationWarning
        />
      )}
      {showChar && (
        <div
          aria-hidden
          className={cn("absolute inset-0 bg-muted", roundedClass)}
        />
      )}
      {effectiveSrc && !showChar && (
        <div
          className={cn("relative size-full overflow-hidden", roundedClass)}
          style={{ opacity: imgLoaded ? 1 : 0 }}
          suppressHydrationWarning
        >
          <Image
            alt={alt}
            className="object-cover"
            fill
            loading={preload ? "eager" : loading}
            onError={() => {
              if (fallback && currentSrc !== fallback) {
                setCurrentSrc(fallback);
                setImgLoaded(false);
              } else {
                setShowChar(true);
                onDisplayReady?.();
              }
            }}
            onLoad={() => {
              if (effectiveSrc) {
                lastLoadedUrlRef.current = effectiveSrc;
              }
              setImgLoaded(true);
              onDisplayReady?.();
            }}
            preload={preload}
            sizes={`${SIZE_PX[size]}px`}
            src={effectiveSrc}
          />
        </div>
      )}
    </div>
  );
}
