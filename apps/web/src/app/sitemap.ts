import type { MetadataRoute } from "next";

import { BASE_URL } from "@/config/app";

/** Only index the root landing URL. */
const STATIC_PAGES = [""] as const;

/** One timestamp per server process — avoids `new Date()` on every sitemap request. */
const sitemapLastModified = new Date();

export default function sitemap(): MetadataRoute.Sitemap {
  return STATIC_PAGES.map((path) => ({
    url: `${BASE_URL}${path}`,
    lastModified: sitemapLastModified,
    changeFrequency: path === "" ? "daily" : "weekly",
    priority: path === "" ? 1 : 0.8,
  }));
}
