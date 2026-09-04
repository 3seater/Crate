import type { MetadataRoute } from "next";

import { source } from "@/lib/source";

const DOCS_BASE = "https://docs.doji.bet";

const sitemapLastModified = new Date();

export default function sitemap(): MetadataRoute.Sitemap {
  return source.getPages().map((page) => ({
    url: `${DOCS_BASE}${page.url}`,
    lastModified: sitemapLastModified,
    changeFrequency: "weekly" as const,
    priority: page.slugs.length === 0 ? 1 : 0.8,
  }));
}
