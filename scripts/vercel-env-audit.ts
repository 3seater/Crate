#!/usr/bin/env tsx
/**
 * Vercel Environment Variable Audit Script
 *
 * Compares local .env files against Vercel-stored env vars for a given app and environment.
 * Run: pnpm vercel:env:audit --app web --env production
 *
 * Requirements: 7.1, 7.2, 7.3, 7.4, 7.5, 7.6, 11.2
 */

import { execSync } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type App = "web" | "server";
type VercelEnvironment = "production" | "preview" | "development";
type Status = "matched" | "missingLocal" | "missingRemote" | "valueMismatch";

interface AuditResult {
  app: App;
  matched: string[];
  missingLocal: string[];
  missingRemote: string[];
  valueMismatch: string[];
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const APP_DIRS: Record<App, string> = {
  web: "apps/web",
  server: "apps/server",
};

const SENSITIVE_KEYS = new Set([
  "MAGIC_SECRET_KEY",
  "CREDENTIAL_ENCRYPTION_KEY",
  "JWT_SESSION_SECRET",
  "POLYMARKET_BUILDER_ID",
  "POLYMARKET_BUILDER_PASSPHRASE",
  "POLY_BUILDER_CODE",
  "DATABASE_URL",
  "DATABASE_URL_DIRECT",
  "POLYMARKET_SIGN_TOKENS",
  "DISCORD_OPS_WEBHOOK_URL",
  "DISCORD_BUG_REPORT_WEBHOOK_URL",
  "SENTRY_AUTH_TOKEN",
]);

/** Vars injected by Vercel/Neon/Sentry integrations — expected to be missing locally. */
const PLATFORM_INJECTED = new Set([
  // Vercel platform
  "VERCEL",
  "VERCEL_OIDC_TOKEN",
  "VERCEL_URL",
  "VERCEL_ENV",
  "VERCEL_TARGET_ENV",
  "VERCEL_GIT_COMMIT_SHA",
  "VERCEL_GIT_COMMIT_REF",
  "VERCEL_GIT_COMMIT_AUTHOR_LOGIN",
  "VERCEL_GIT_COMMIT_AUTHOR_NAME",
  "VERCEL_GIT_COMMIT_MESSAGE",
  "VERCEL_GIT_PREVIOUS_SHA",
  "VERCEL_GIT_PROVIDER",
  "VERCEL_GIT_PULL_REQUEST_ID",
  "VERCEL_GIT_REPO_ID",
  "VERCEL_GIT_REPO_OWNER",
  "VERCEL_GIT_REPO_SLUG",
  // Turbo (Vercel remote caching)
  "TURBO_CACHE",
  "TURBO_DOWNLOAD_LOCAL_ENABLED",
  "TURBO_REMOTE_ONLY",
  "TURBO_RUN_SUMMARY",
  // Vercel serverless
  "NODEJS_HELPERS",
  // Neon integration
  "NEON_PROJECT_ID",
  "POSTGRES_URL",
  "POSTGRES_URL_NON_POOLING",
  "POSTGRES_URL_NO_SSL",
  "POSTGRES_PRISMA_URL",
  "POSTGRES_HOST",
  "POSTGRES_USER",
  "POSTGRES_PASSWORD",
  "POSTGRES_DATABASE",
  "PGHOST",
  "PGHOST_UNPOOLED",
  "PGUSER",
  "PGPASSWORD",
  "PGDATABASE",
  "DATABASE_URL_UNPOOLED",
  // Sentry Vercel integration
  "SENTRY_ORG",
  "SENTRY_PROJECT",
  "SENTRY_PUBLIC_KEY",
  "SENTRY_OTLP_TRACES_URL",
  "SENTRY_VERCEL_LOG_DRAIN_URL",
]);

/** Static defaults — same across all environments. */
const STATIC_DEFAULTS: Record<string, string> = {
  GAMMA_API_URL: "https://gamma-api.polymarket.com",
  DATA_API_URL: "https://data-api.polymarket.com",
  BRIDGE_API_URL: "https://bridge.polymarket.com",
  CLOB_API_URL: "https://clob.polymarket.com",
  CHAIN_ID: "137",
  PORT: "3001",
  POLYGON_RPC_URL: "https://polygon.drpc.org",
  SENTRY_DEBUG: "false",
  SENTRY_STRICT_TRACE_CONTINUATION: "false",
  SENTRY_ERROR_SAMPLE_RATE: "1",
  SUBGRAPH_ENABLE_TRADE_COUNTS: "true",
  NEXT_PUBLIC_CLOB_API_URL: "https://clob.polymarket.com",
  NEXT_PUBLIC_WS_MARKET_URL:
    "wss://ws-subscriptions-clob.polymarket.com/ws/market",
  NEXT_PUBLIC_WS_USER_URL: "wss://ws-subscriptions-clob.polymarket.com/ws/user",
  NEXT_PUBLIC_RTDS_URL: "wss://ws-live-data.polymarket.com",
  NEXT_PUBLIC_WS_SPORTS_URL: "wss://sports-api.polymarket.com/ws",
  NEXT_PUBLIC_CHAIN_ID: "137",
  NEXT_PUBLIC_POLYGON_RPC_URL: "https://polygon.drpc.org",
  NEXT_PUBLIC_SENTRY_DEBUG: "false",
  NEXT_PUBLIC_SIMULATE_GEOBLOCKED: "false",
  NEXT_PUBLIC_FEATURE_FUNNELS: "false",
  CLOB_V2_ENABLED: "true",
};

/** Expected values per environment — merges static defaults with env-specific overrides. */
function getExpectedValues(env: VercelEnvironment): Record<string, string> {
  const servers: Record<VercelEnvironment, string> = {
    production: "https://api.doji.bet",
    preview: "https://staging-api.doji.bet",
    development: "http://localhost:3001",
  };
  const webs: Record<VercelEnvironment, string> = {
    production: "https://doji.bet",
    preview: "https://staging.doji.bet",
    development: "http://localhost:3000",
  };
  const cors: Record<VercelEnvironment, string> = {
    production: "https://doji.bet,https://www.doji.bet",
    preview: "https://staging.doji.bet,https://doji.bet,https://www.doji.bet",
    development: "http://localhost:3000,http://127.0.0.1:3000",
  };
  const sentryEnvs: Record<VercelEnvironment, string> = {
    production: "production",
    preview: "staging",
    development: "development",
  };
  const isDev = env === "development";

  return {
    ...STATIC_DEFAULTS,
    CORS_ORIGIN: cors[env],
    SERVER_URL: servers[env],
    NEXT_PUBLIC_SERVER_URL: servers[env],
    NEXT_PUBLIC_APP_URL: webs[env],
    SENTRY_ENVIRONMENT: sentryEnvs[env],
    NODE_ENV: isDev ? "development" : "production",
    REFERRAL_GATE_ENABLED: "false",
    NEXT_PUBLIC_DISABLE_GEOBLOCK: isDev ? "true" : "false",
    NEXT_PUBLIC_FEATURE_REFERRALS: "true",
    SENTRY_TRACES_SAMPLE_RATE: isDev ? "1" : "0.1",
    SENTRY_PROFILES_SAMPLE_RATE: isDev ? "1" : "0.1",
  };
}

// ---------------------------------------------------------------------------
// CLI arg parsing
// ---------------------------------------------------------------------------

function parseArgs(): { app: App; env: VercelEnvironment } {
  const args = process.argv.slice(2);
  let app: string | undefined;
  let env: string | undefined;

  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--app" && args[i + 1]) {
      app = args[++i];
    } else if (args[i] === "--env" && args[i + 1]) {
      env = args[++i];
    }
  }

  if (!(app && ["web", "server"].includes(app))) {
    console.error("Error: --app must be 'web' or 'server'");
    process.exit(1);
  }
  if (!(env && ["production", "preview", "development"].includes(env))) {
    console.error(
      "Error: --env must be 'production', 'preview', or 'development'"
    );
    process.exit(1);
  }

  return { app: app as App, env: env as VercelEnvironment };
}

// ---------------------------------------------------------------------------
// Vercel CLI helpers
// ---------------------------------------------------------------------------

function assertVercelAuth(): void {
  try {
    execSync("vercel whoami", { stdio: "pipe" });
  } catch {
    console.error(
      "Error: Vercel CLI is not authenticated. Run `vercel login` first."
    );
    process.exit(1);
  }
}

/**
 * Pulls remote env vars by running `vercel env pull` to a temp file,
 * then parsing the resulting .env file to get key-value pairs.
 */
function pullRemoteEnvVars(
  app: App,
  environment: VercelEnvironment
): Record<string, string> {
  const cwd = APP_DIRS[app];
  const tempDir = mkdtempSync(join(tmpdir(), "vercel-env-audit-"));
  const tempFile = join(tempDir, ".env.pulled");

  try {
    execSync(
      `vercel env pull "${tempFile}" --environment ${environment} --yes`,
      { cwd, stdio: "pipe" }
    );
    const vars = parseEnvFile(tempFile);
    return vars;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (message.includes("not authenticated") || message.includes("login")) {
      console.error(
        "Error: Vercel CLI is not authenticated. Run `vercel login` first."
      );
      process.exit(1);
    }
    console.error(
      `Error: Failed to pull remote env vars for ${app}/${environment}: ${message}`
    );
    process.exit(1);
  } finally {
    rmSync(tempDir, { recursive: true, force: true });
  }
}

// ---------------------------------------------------------------------------
// Local env file helpers
// ---------------------------------------------------------------------------

/**
 * Finds the local env file for the given app.
 * Checks .env.local first, then .env as fallback.
 */
function findLocalEnvFile(app: App): string {
  const dir = APP_DIRS[app];
  const envLocal = join(dir, ".env.local");
  const envFile = join(dir, ".env");

  if (existsSync(envLocal)) {
    return envLocal;
  }
  if (existsSync(envFile)) {
    return envFile;
  }

  console.error(
    `Error: No .env.local or .env file found for ${app} in ${dir}. ` +
      `Create one or run 'vercel env pull' first.`
  );
  process.exit(1);
}

/**
 * Parses a .env file into a key-value record.
 * Handles comments, empty lines, and quoted values.
 */
function parseEnvFile(filePath: string): Record<string, string> {
  const content = readFileSync(filePath, "utf-8");
  const vars: Record<string, string> = {};

  for (const line of content.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) {
      continue;
    }

    const eqIndex = trimmed.indexOf("=");
    if (eqIndex === -1) {
      continue;
    }

    const key = trimmed.slice(0, eqIndex).trim();
    let value = trimmed.slice(eqIndex + 1).trim();

    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }

    if (key) {
      vars[key] = value;
    }
  }

  return vars;
}

// ---------------------------------------------------------------------------
// Audit logic
// ---------------------------------------------------------------------------

/**
 * Classifies every key in the union of remote and local sets into exactly
 * one of: matched, missingLocal, missingRemote, valueMismatch.
 */
function classifyKeys(
  remoteVars: Record<string, string>,
  localVars: Record<string, string>
): Pick<
  AuditResult,
  "matched" | "missingLocal" | "missingRemote" | "valueMismatch"
> {
  const allKeys = new Set([
    ...Object.keys(remoteVars),
    ...Object.keys(localVars),
  ]);

  const matched: string[] = [];
  const missingLocal: string[] = [];
  const missingRemote: string[] = [];
  const valueMismatch: string[] = [];

  for (const key of allKeys) {
    const inRemote = key in remoteVars;
    const inLocal = key in localVars;

    if (inRemote && !inLocal) {
      missingLocal.push(key);
    } else if (!inRemote && inLocal) {
      missingRemote.push(key);
    } else if (inRemote && inLocal) {
      if (remoteVars[key] === localVars[key]) {
        matched.push(key);
      } else {
        valueMismatch.push(key);
      }
    }
  }

  return { matched, missingLocal, missingRemote, valueMismatch };
}

// ---------------------------------------------------------------------------
// Output formatting
// ---------------------------------------------------------------------------

const STATUS_LABELS: Record<Status, string> = {
  matched: "✓ matched",
  missingLocal: "✗ missing local",
  missingRemote: "✗ missing remote",
  valueMismatch: "≠ value mismatch",
};

function buildRows(
  result: AuditResult
): Array<{ key: string; status: Status }> {
  const rows: Array<{ key: string; status: Status }> = [];
  for (const key of result.matched) {
    rows.push({ key, status: "matched" });
  }
  for (const key of result.missingLocal) {
    rows.push({ key, status: "missingLocal" });
  }
  for (const key of result.missingRemote) {
    rows.push({ key, status: "missingRemote" });
  }
  for (const key of result.valueMismatch) {
    rows.push({ key, status: "valueMismatch" });
  }
  return rows;
}

function printTable(
  result: AuditResult,
  environment: VercelEnvironment,
  localVars: Record<string, string>
): void {
  const expectedValues = getExpectedValues(environment);
  const allRows = buildRows(result);

  // Separate platform-injected vars from app vars
  const rows = allRows.filter((r) => !PLATFORM_INJECTED.has(r.key));
  const platformRows = allRows.filter((r) => PLATFORM_INJECTED.has(r.key));

  rows.sort((a, b) => a.key.localeCompare(b.key));

  if (rows.length === 0) {
    console.log("No environment variables found.");
    return;
  }

  console.log(
    `\nAudit: ${result.app} / ${environment} (${new Date().toISOString()})`
  );
  console.log("─".repeat(120));

  const maxKeyLen = Math.max(...rows.map((r) => r.key.length), 3);
  const header = `${"Key".padEnd(maxKeyLen)}  ${"Status".padEnd(30)}  ${"Local".padEnd(40)}  Expected`;
  console.log(header);
  console.log("─".repeat(120));

  for (const row of rows) {
    const sensitive = SENSITIVE_KEYS.has(row.key) ? " [sensitive]" : "";
    const statusStr = `${STATUS_LABELS[row.status]}${sensitive}`;
    const expected = expectedValues[row.key] ?? "";
    const showExpected =
      row.status === "missingLocal" ||
      row.status === "missingRemote" ||
      row.status === "valueMismatch"
        ? expected
        : "";

    // Show local value — mask sensitive keys
    let localVal = "";
    if (row.status === "valueMismatch" || row.status === "missingRemote") {
      if (SENSITIVE_KEYS.has(row.key)) {
        localVal = "••••••";
      } else {
        localVal = localVars[row.key] ?? "";
      }
    }

    console.log(
      `${row.key.padEnd(maxKeyLen)}  ${statusStr.padEnd(30)}  ${localVal.padEnd(40)}  ${showExpected}`
    );
  }

  console.log("─".repeat(120));

  const appMissingLocal = result.missingLocal.filter(
    (k) => !PLATFORM_INJECTED.has(k)
  );
  const appMissingRemote = result.missingRemote.filter(
    (k) => !PLATFORM_INJECTED.has(k)
  );

  console.log(
    `Matched: ${result.matched.length}  |  ` +
      `Missing local: ${appMissingLocal.length}  |  ` +
      `Missing remote: ${appMissingRemote.length}  |  ` +
      `Value mismatch: ${result.valueMismatch.length}`
  );

  if (platformRows.length > 0) {
    console.log(
      `\n(${platformRows.length} platform-injected vars hidden: Neon, Vercel OIDC, etc.)`
    );
  }
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

function main(): void {
  const { app, env } = parseArgs();

  // Verify Vercel CLI auth
  assertVercelAuth();

  // Find local env file (exits if not found)
  const localEnvPath = findLocalEnvFile(app);
  const localVars = parseEnvFile(localEnvPath);

  console.log(`Pulling remote env vars for ${app}/${env}...`);
  const remoteVars = pullRemoteEnvVars(app, env);

  // Classify keys
  const classification = classifyKeys(remoteVars, localVars);

  const result: AuditResult = {
    app,
    ...classification,
  };

  // Print results — never prints actual values, only key names and status
  printTable(result, env, localVars);

  // Exit with non-zero if there are actionable issues (excluding platform-injected)
  const actionableMissingLocal = result.missingLocal.filter(
    (k) => !PLATFORM_INJECTED.has(k)
  );
  const actionableMissingRemote = result.missingRemote.filter(
    (k) => !PLATFORM_INJECTED.has(k)
  );

  const hasIssues =
    actionableMissingLocal.length > 0 ||
    actionableMissingRemote.length > 0 ||
    result.valueMismatch.length > 0;

  if (hasIssues) {
    process.exit(1);
  }
}

// Export for testing
export {
  type App,
  type AuditResult,
  classifyKeys,
  parseEnvFile,
  SENSITIVE_KEYS,
  type VercelEnvironment,
};

main();
