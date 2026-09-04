import type { MetadataRoute } from "next";

import { BASE_URL } from "@/config/app";

export default function robots(): MetadataRoute.Robots {
  /** Block preview deployments from being indexed (Vercel sets VERCEL_ENV=preview). */
  if (process.env.VERCEL_ENV === "preview") {
    return {
      rules: { userAgent: "*", disallow: "/" },
      host: BASE_URL,
    };
  }

  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: ["/api/"],
    },
    sitemap: `${BASE_URL}/sitemap.xml`,
    host: BASE_URL,
  };
}
