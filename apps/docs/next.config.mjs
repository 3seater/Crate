import { createMDX } from "fumadocs-mdx/next";

const withMDX = createMDX();

/** @type {import('next').NextConfig} */
const config = {
  reactStrictMode: true,
  async redirects() {
    return [
      { source: "/docs", destination: "/", permanent: false },
      { source: "/docs/:path*", destination: "/:path*", permanent: false },
    ];
  },
  logging: {
    fetches: {
      fullUrl: true,
      hmrRefreshes: false,
    },
    browserToTerminal: true,
  },
  experimental: {
    turbopackFileSystemCacheForBuild: true,
  },
  async rewrites() {
    return [
      {
        source: "/:path*.mdx",
        destination: "/llms.mdx/:path*",
      },
    ];
  },
};

export default withMDX(config);
