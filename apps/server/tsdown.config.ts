import { defineConfig } from "tsdown";

export default defineConfig({
  entry: "./src/index.ts",
  format: "esm",
  outDir: "./dist",
  clean: true,
  define: {
    // Tree-shake Sentry SDK debug-only branches at build time.
    __SENTRY_DEBUG__: "false",
    // Keep tracing code because this service uses spans/metrics/profiling.
    __SENTRY_TRACING__: "true",
  },
  deps: {
    alwaysBundle: [/@doji\/.*/],
    // tsdown 0.20+ fails if deps are bundled without explicit choice; we intentionally bundle.
    onlyBundle: false,
  },
});
