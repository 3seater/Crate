import type { MetadataRoute } from "next";

const SHARED_THEME_COLOR = "#0d1014";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Doji",
    short_name: "Doji",
    description: "The better way to trade what happens next.",
    id: "/",
    start_url: "/",
    scope: "/",
    display: "standalone",
    background_color: SHARED_THEME_COLOR,
    theme_color: SHARED_THEME_COLOR,
    icons: [
      {
        src: "/android-chrome-192x192.png",
        sizes: "192x192",
        type: "image/png",
      },
      {
        src: "/android-chrome-512x512.png",
        sizes: "512x512",
        type: "image/png",
      },
      {
        src: "/apple-touch-icon.png",
        sizes: "180x180",
        type: "image/png",
      },
      {
        src: "/favicon.ico",
        sizes: "any",
        type: "image/x-icon",
      },
    ],
  };
}
