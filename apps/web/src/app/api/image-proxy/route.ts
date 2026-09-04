import type { NextRequest } from "next/server";

/**
 * Proxy external images to avoid CORS when inlining for html-to-image capture.
 * Only allows known image hosts (Polymarket S3, GitHub assets).
 */

const ALLOWED_HOSTS = new Set([
  "polymarket-upload.s3.us-east-2.amazonaws.com",
  "raw.githubusercontent.com",
  "cdn-api.pandascore.co",
  "lh3.googleusercontent.com", // Google/Magic avatars
  "images.polymarket.com",
  "assets.polymarket.com",
]);

export async function GET(req: NextRequest) {
  const url = req.nextUrl.searchParams.get("url");
  if (!url) {
    return new Response("Missing url param", { status: 400 });
  }

  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return new Response("Invalid url", { status: 400 });
  }

  if (!ALLOWED_HOSTS.has(parsed.hostname)) {
    return new Response("Host not allowed", { status: 403 });
  }

  try {
    // Team logos are immutable assets — cache aggressively at the fetch layer
    const res = await fetch(url, { next: { revalidate: 86_400 } });
    if (!res.ok) {
      return new Response("Upstream error", { status: res.status });
    }
    const contentType = res.headers.get("content-type") ?? "image/png";
    const body = await res.arrayBuffer();
    return new Response(body, {
      headers: {
        "Content-Type": contentType,
        // Logos are stable — cache in browser for 7 days, CDN for 1 day
        "Cache-Control": "public, max-age=604800, s-maxage=86400, immutable",
      },
    });
  } catch {
    return new Response("Fetch failed", { status: 502 });
  }
}
