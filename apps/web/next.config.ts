import { env } from "@doji/env/web";
import bundleAnalyzer from "@next/bundle-analyzer";
import { withSentryConfig } from "@sentry/nextjs";
import { withVercelToolbar } from "@vercel/toolbar/plugins/next";
import type { NextConfig } from "next";

const withBundleAnalyzer = bundleAnalyzer({
  enabled: process.env.ANALYZE === "true",
  openAnalyzer: false,
  analyzerMode: "static",
});

/** Build CSP connect-src. Covers tRPC (/api/trpc on same origin), WalletConnect, DexScreener prices. */
const getCspConnectSrc = () => {
  const sentryCspReportOrigin = env.NEXT_PUBLIC_SENTRY_CSP_REPORT_URI
    ? new URL(env.NEXT_PUBLIC_SENTRY_CSP_REPORT_URI).origin
    : null;
  const sentryCspConnect = sentryCspReportOrigin
    ? ` ${sentryCspReportOrigin}`
    : "";
  return [
    "'self'",
    // tRPC is on same origin via /api/trpc — no external server URL needed
    // External price APIs called server-side — no client CSP entry needed
    // WalletConnect / Reown
    "https://*.walletconnect.com",
    "https://*.reown.com",
    "wss://*.walletconnect.com",
    "https://pulse.walletconnect.org",
    "https://api.web3modal.org",
    // Sentry
    sentryCspConnect,
  ]
    .filter(Boolean)
    .join(" ");
};

const cspBaseDirectives = [
  "frame-src 'self' https://dexscreener.com",
  `connect-src ${getCspConnectSrc()}`,
  "worker-src 'self' blob:",
];

const cspReportUri = env.NEXT_PUBLIC_SENTRY_CSP_REPORT_URI;
const cspGroup = "csp-endpoint";
const cspReportingDirectives = cspReportUri
  ? [`report-uri ${cspReportUri}`, `report-to ${cspGroup}`]
  : [];
const cspWithReporting = [...cspBaseDirectives, ...cspReportingDirectives].join(
  "; "
);

const nextConfig: NextConfig = {
  cacheComponents: true,
  typedRoutes: true,
  typescript: {
    // !! WARN !!
    // Dangerously allow production builds to successfully complete even if
    // your project has type errors.
    // !! WARN !!
    ignoreBuildErrors: false,
  },
  reactCompiler: true,
  // "standalone" is for Docker/self-hosting. Netlify uses its own runtime — don't set this.
  // output: "standalone",
  transpilePackages: [
    "@doji/types",
    "@doji/api",
    "@doji/env",
    "@doji/hooks",
    "@doji/logger",
  ],
  images: {
    /** Cache optimized event/market images for 1 year (reduces refetches from Polymarket CDN). */
    minimumCacheTTL: 31_536_000,
    /** Prefer AVIF (30-50% smaller than WebP) with WebP fallback. */
    formats: ["image/avif", "image/webp"],
    /** Required in Next.js 16 — allowlist quality values. */
    qualities: [75],
    // TODO: Research caching polymarket images for less hops
    remotePatterns: [
      {
        protocol: "https",
        hostname: "polymarket-upload.s3.us-east-2.amazonaws.com",
      },
      {
        protocol: "https",
        hostname: "images.polymarket.com",
      },
      {
        protocol: "https",
        hostname: "assets.polymarket.com",
      },
      {
        protocol: "https",
        hostname: "raw.githubusercontent.com",
        pathname: "/trustwallet/assets/**",
      },
      {
        protocol: "https",
        hostname: "cdn-api.pandascore.co",
        pathname: "/images/team/image/**",
      },
      {
        protocol: "https",
        hostname: "lh3.googleusercontent.com",
      },
      {
        protocol: "https",
        hostname: "pbs.twimg.com",
      },
      {
        protocol: "https",
        hostname: "abs.twimg.com",
      },
      {
        protocol: "https",
        hostname: "upload.wikimedia.org",
      },
    ],
  },
  logging: {
    fetches: {
      fullUrl: true,
      hmrRefreshes: false,
    },
  },
  experimental: {
    useCache: true,
    inlineCss: true,
    instantNavigationDevToolsToggle: true,
    viewTransition: true,
    optimizePackageImports: [
      "@base-ui/react",
      "@tanstack/react-query",
      "@tanstack/react-table",
      "date-fns",
      "lucide-react",
      "recharts",
    ],
    turbopackFileSystemCacheForBuild: true,
    staleTimes: { dynamic: 30 },
  },
  /** No custom webpack plugins needed — Turbopack handles everything. */
  webpack: (config) => config,
  async headers() {
    const headers: {
      source: string;
      headers: { key: string; value: string }[];
    }[] = [
      {
        source: "/(.*)",
        headers: [
          { key: "Content-Security-Policy", value: cspWithReporting },
          // Required by Sentry browser profiling (JS Self-Profiling API).
          { key: "Document-Policy", value: "js-profiling" },
        ],
      },
    ];
    if (cspReportUri) {
      const reportTo = JSON.stringify({
        group: cspGroup,
        max_age: 10_886_400,
        endpoints: [{ url: cspReportUri }],
        include_subdomains: true,
      });
      headers[0]?.headers.push({ key: "Report-To", value: reportTo });
      headers[0]?.headers.push({
        key: "Reporting-Endpoints",
        value: `${cspGroup}="${cspReportUri}"`,
      });
    }
    return headers;
  },
};

export default withSentryConfig(
  withBundleAnalyzer(withVercelToolbar()(nextConfig)),
  {
    // For all available options, see:
    // https://www.npmjs.com/package/@sentry/webpack-plugin#options

    org: "doji-5y",

    project: "doji-web",
    authToken: process.env.SENTRY_AUTH_TOKEN,
    telemetry: false,
    debug: process.env.SENTRY_DEBUG === "1",

    // Only print logs for uploading source maps in CI
    silent: !process.env.CI,
    errorHandler: (error) => {
      console.warn("[sentry-build] source map upload warning:", error);
    },

    // For all available options, see:
    // https://docs.sentry.io/platforms/javascript/guides/nextjs/manual-setup/

    // Upload a larger set of source maps for prettier stack traces (increases build time)
    widenClientFileUpload: true,
    sourcemaps: {
      deleteSourcemapsAfterUpload: true,
    },
    release: {
      name: process.env.SENTRY_RELEASE,
      create: true,
      finalize: true,
    },

    // Route browser requests to Sentry through a Next.js rewrite to circumvent ad-blockers.
    // This can increase your server load as well as your hosting bill.
    // Note: Check that the configured route will not match with your Next.js middleware, otherwise reporting of client-
    // side errors will fail.
    tunnelRoute: "/monitoring",

    webpack: {
      // Enables automatic instrumentation of Vercel Cron Monitors. (Does not yet work with App Router route handlers.)
      // See the following for more information:
      // https://docs.sentry.io/product/crons/
      // https://vercel.com/docs/cron-jobs
      automaticVercelMonitors: true,

      // Tree-shaking options for reducing bundle size
      treeshake: {
        // Automatically tree-shake Sentry logger statements to reduce bundle size
        removeDebugLogging: true,
        // We actively use tracing/profiling APIs, so tracing must stay enabled.
        removeTracing: false,
        // Session Replay is not enabled (bundle + privacy). These flags tree-shake replay code.
        // Turning on Replay later requires setting `replayIntegration()` in the client Sentry init and removing
        // these excludes after a privacy review (PII, wallet flows). User Feedback widget is independent.
        excludeReplayIframe: true,
        excludeReplayShadowDOM: true,
        excludeReplayCompressionWorker: true,
      },
    },
  }
);
