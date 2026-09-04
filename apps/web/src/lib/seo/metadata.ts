import type { Metadata } from "next";

import {
  APP_DESCRIPTION,
  APP_KEYWORDS,
  APP_TITLE,
  BASE_URL,
} from "@/config/app";

const DEFAULT_OG_IMAGE_URL = new URL("/opengraph-image.jpg", BASE_URL).href;

export const defaultMetadata: Metadata = {
  metadataBase: new URL(BASE_URL),
  title: {
    default: APP_TITLE,
    template: `%s | ${APP_TITLE}`,
  },
  description: APP_DESCRIPTION,
  keywords: APP_KEYWORDS,
  formatDetection: {
    email: false,
    address: false,
    telephone: false,
  },
  openGraph: {
    type: "website",
    locale: "en_US",
    url: BASE_URL,
    siteName: APP_TITLE,
    title: APP_TITLE,
    description: APP_DESCRIPTION,
    images: [DEFAULT_OG_IMAGE_URL],
  },
  twitter: {
    card: "summary_large_image",
    title: APP_TITLE,
    description: APP_DESCRIPTION,
    images: [DEFAULT_OG_IMAGE_URL],
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-video-preview": -1,
      "max-image-preview": "large",
      "max-snippet": -1,
    },
  },
  icons: {
    icon: [
      { url: "/favicon.ico", type: "image/png" },
      { url: "/favicon.png", type: "image/png" },
    ],
    shortcut: "/favicon.ico",
    apple: "/favicon.png",
  },
  manifest: "/manifest.webmanifest",
};

function mergeObjectMetadata<T extends object>(
  base: T | undefined,
  override: T | string
): T {
  if (typeof override === "string") {
    return base ?? ({} as T);
  }
  return base ? { ...base, ...override } : override;
}

/** String form of `metadata.title` for og:title / twitter:title. */
function resolveTitleForSocial(merged: Metadata): string | undefined {
  const t = merged.title;
  if (t == null) {
    return;
  }
  if (typeof t === "string") {
    return t;
  }
  if (typeof t === "object") {
    if ("absolute" in t && t.absolute) {
      return String(t.absolute);
    }
    if ("default" in t && t.default) {
      return String(t.default);
    }
  }
  return;
}

function resolveDescriptionForSocial(merged: Metadata): string | undefined {
  const d = merged.description;
  if (d == null) {
    return;
  }
  return typeof d === "string" ? d : undefined;
}

function resolveCanonicalString(merged: Metadata): string | undefined {
  const c = merged.alternates?.canonical;
  if (c == null) {
    return;
  }
  if (typeof c === "string") {
    return c;
  }
  return String(c);
}

function hasOwnKey(obj: object, key: string): boolean {
  return Object.hasOwn(obj, key);
}

function openGraphFieldExplicit(
  overrides: Metadata,
  key: "title" | "description" | "url"
): boolean {
  const og = overrides.openGraph;
  if (!og || typeof og !== "object") {
    return false;
  }
  return (
    hasOwnKey(og, key) && (og as Record<string, unknown>)[key] !== undefined
  );
}

function twitterFieldExplicit(
  overrides: Metadata,
  key: "title" | "description"
): boolean {
  const tw = overrides.twitter;
  if (!tw || typeof tw !== "object") {
    return false;
  }
  return (
    hasOwnKey(tw, key) && (tw as Record<string, unknown>)[key] !== undefined
  );
}

/** Fill og/twitter from merged title, description, canonical when not explicitly overridden. */
function syncOpenGraphAndTwitterFromPageFields(
  merged: Metadata,
  overrides: Metadata
): void {
  const resolvedTitle = resolveTitleForSocial(merged);
  const resolvedDescription = resolveDescriptionForSocial(merged);
  const canonicalUrl = resolveCanonicalString(merged);

  const og = { ...(merged.openGraph as Record<string, unknown>) };
  if (
    !openGraphFieldExplicit(overrides, "title") &&
    resolvedTitle !== undefined
  ) {
    og.title = resolvedTitle;
  }
  if (
    !openGraphFieldExplicit(overrides, "description") &&
    resolvedDescription !== undefined
  ) {
    og.description = resolvedDescription;
  }
  if (!openGraphFieldExplicit(overrides, "url") && canonicalUrl !== undefined) {
    og.url = canonicalUrl;
  }
  merged.openGraph = og as Metadata["openGraph"];

  const tw = { ...(merged.twitter as Record<string, unknown>) };
  if (
    !twitterFieldExplicit(overrides, "title") &&
    resolvedTitle !== undefined
  ) {
    tw.title = resolvedTitle;
  }
  if (
    !twitterFieldExplicit(overrides, "description") &&
    resolvedDescription !== undefined
  ) {
    tw.description = resolvedDescription;
  }
  merged.twitter = tw as Metadata["twitter"];
}

/**
 * Merge page metadata overrides with defaults.
 * Preserves nested openGraph/twitter when overriding individual fields.
 *
 * After merge, syncs `openGraph` / `twitter` title, description, and `openGraph.url`
 * from top-level `title` / `description` / `alternates.canonical` when those nested
 * fields were not set explicitly in `overrides` (fixes Discord/Slack using default site copy).
 */
export function createPageMetadata(overrides: Metadata): Metadata {
  const merged: Metadata = { ...defaultMetadata };

  for (const [key, value] of Object.entries(overrides)) {
    if (value === undefined) {
      continue;
    }
    const k = key as keyof Metadata;
    if (k === "openGraph" && value && typeof value === "object") {
      merged.openGraph = mergeObjectMetadata(
        merged.openGraph as Record<string, unknown> | undefined,
        value as Record<string, unknown>
      ) as Metadata["openGraph"];
    } else if (k === "twitter" && value && typeof value === "object") {
      merged.twitter = mergeObjectMetadata(
        merged.twitter as Record<string, unknown> | undefined,
        value as Record<string, unknown>
      ) as Metadata["twitter"];
    } else if (k === "robots" && value && typeof value === "object") {
      merged.robots = mergeObjectMetadata(
        merged.robots as Record<string, unknown> | undefined,
        value as Record<string, unknown>
      ) as Metadata["robots"];
    } else {
      (merged as Record<string, unknown>)[k] = value;
    }
  }

  syncOpenGraphAndTwitterFromPageFields(merged, overrides);

  return merged;
}
