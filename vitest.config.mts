import path from "node:path";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "apps/web/src"),
      "@doji/db": path.resolve(import.meta.dirname, "packages/db/src"),
      "server-only": path.resolve(
        import.meta.dirname,
        "tests/__mocks__/server-only.ts"
      ),
      "client-only": path.resolve(
        import.meta.dirname,
        "tests/__mocks__/client-only.ts"
      ),
      react: path.resolve(import.meta.dirname, "apps/web/node_modules/react"),
      "react-dom": path.resolve(
        import.meta.dirname,
        "apps/web/node_modules/react-dom"
      ),
      "drizzle-orm": path.resolve(
        import.meta.dirname,
        "packages/db/node_modules/drizzle-orm"
      ),
      "drizzle-orm/node-postgres": path.resolve(
        import.meta.dirname,
        "packages/db/node_modules/drizzle-orm/node-postgres"
      ),
    },
  },
  test: {
    include: ["tests/**/*.test.{ts,tsx}"],
    globals: true,
    environment: "node",
    setupFiles: ["tests/setup.ts"],
    testTimeout: 10_000,
    hookTimeout: 10_000,
    coverage: {
      provider: "v8",
      reporter: ["text", "text-summary", "html"],
      exclude: [
        "**/node_modules/**",
        "**/dist/**",
        "**/*.config.{ts,mts,js,mjs}",
        "**/*.d.ts",
        "**/scripts/**",
      ],
    },
  },
});
