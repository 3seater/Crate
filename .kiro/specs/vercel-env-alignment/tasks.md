# Implementation Plan: Vercel Environment Alignment

## Overview

Align the Doji monorepo's environment variable configuration across Vercel Production, Preview, and Development targets. Tasks are ordered: schema/config changes first (turbo.json, T3 Env), then tooling (audit script, domain map), then documentation. Each task builds incrementally on the previous.

## Tasks

- [x] 1. Turborepo cache key alignment and stale var cleanup
  - [x] 1.1 Remove stale vars from `turbo.json` `tasks.build.env`
    - Remove `SITE_PASSWORD`, `DATABASE_URL_UNPOOLED`, and `POSTGRES_PRISMA_URL` from the `build.env` array
    - _Requirements: 5.4, 6.1, 6.2, 6.3_

  - [x] 1.2 Add `VERCEL_URL` to `turbo.json` `globalEnv`
    - Add `VERCEL_URL` to the existing `globalEnv` array alongside `NODE_ENV`, `CI`, `VERCEL`, `VERCEL_ENV`
    - _Requirements: 5.2_

  - [x] 1.3 Add missing T3 Env vars to `turbo.json` `tasks.build.env`
    - Add all ~25 missing env var keys from `packages/env/src/server.ts` and `packages/env/src/web.ts` that are not yet in `turbo.json build.env`
    - Server vars: `SENTRY_DSN`, `SENTRY_CSP_REPORT_URI`, `SENTRY_ORG_ID`, `SENTRY_ENVIRONMENT`, `SENTRY_RELEASE`, `SENTRY_DEBUG`, `SENTRY_STRICT_TRACE_CONTINUATION`, `SENTRY_ERROR_SAMPLE_RATE`, `SENTRY_TRACES_SAMPLE_RATE`, `SENTRY_PROFILES_SAMPLE_RATE`, `POLYGON_RPC_URL`, `ETHERSCAN_API_KEY`, `POLYMARKET_SUBGRAPH_OI_URL`, `POLYMARKET_SUBGRAPH_ORDERS_URL`, `POLYMARKET_SUBGRAPH_ACTIVITY_URL`, `POLYMARKET_SUBGRAPH_PNL_URL`, `POLYMARKET_SUBGRAPH_POSITIONS_URL`, `REFERRAL_GATE_ENABLED`, `SUBGRAPH_ENABLE_TRADE_COUNTS`, `BRIDGE_DISABLED_CHAINS`, `BRIDGE_DISABLED_TOKENS`, `DATABASE_URL_DIRECT`, `DISCORD_OPS_WEBHOOK_URL`
    - Web server vars: `LOG_LEVEL`, `DISCORD_BUG_REPORT_WEBHOOK_URL`, `SENTRY_AUTH_TOKEN`
    - Web client vars: `NEXT_PUBLIC_SENTRY_CSP_REPORT_URI`, `NEXT_PUBLIC_SENTRY_DSN`, `NEXT_PUBLIC_APP_URL`, `NEXT_PUBLIC_FEATURE_REFERRALS`, `NEXT_PUBLIC_FEATURE_FUNNELS`, `NEXT_PUBLIC_DISABLE_GEOBLOCK`, `NEXT_PUBLIC_SIMULATE_GEOBLOCKED`, `NEXT_PUBLIC_SENTRY_DEBUG`
    - _Requirements: 5.1, 5.3_

  - [ ]* 1.4 Write property test for Turbo cache alignment (Property 5)
    - **Property 5: Turbo Cache Alignment** — For any env var key validated by `packages/env/src/server.ts` or `packages/env/src/web.ts`, that key must appear in either `turbo.json globalEnv` or `turbo.json tasks.build.env`. T3_ENV_KEYS ⊆ TURBO_BUILD_ENV.
    - Parse both T3 Env schema files to extract all env var keys, parse `turbo.json` to extract `globalEnv` + `build.env`, assert subset relationship
    - Use `fast-check` with `fc.constantFrom(...t3EnvKeys)` to verify each key is present in turbo vars
    - **Validates: Requirement 5.1**

  - [ ]* 1.5 Write property test for Turbo stale var exclusion (Property 6)
    - **Property 6: Turbo Stale Var Exclusion** — For any var in {`SITE_PASSWORD`, `DATABASE_URL_UNPOOLED`, `POSTGRES_PRISMA_URL`}, that var must not appear in `turbo.json tasks.build.env`.
    - **Validates: Requirements 5.4, 6.1, 6.2, 6.3**

- [x] 2. T3 Env schema completeness — add missing Sentry vars to `web.ts`
  - [x] 2.1 Add `SENTRY_DEBUG` to `packages/env/src/web.ts` server section
    - Add `SENTRY_DEBUG: z.coerce.boolean().default(false)` to the `server` object
    - Add `SENTRY_DEBUG: process.env.SENTRY_DEBUG` to the `runtimeEnv` object
    - _Requirements: 10.1_

  - [x] 2.2 Add `SENTRY_RELEASE` to `packages/env/src/web.ts` server section
    - Add `SENTRY_RELEASE: z.string().optional()` to the `server` object
    - Add `SENTRY_RELEASE: process.env.SENTRY_RELEASE` to the `runtimeEnv` object
    - _Requirements: 10.2_

  - [x] 2.3 Add `SENTRY_AUTH_TOKEN` to `packages/env/src/web.ts` server section
    - Add `SENTRY_AUTH_TOKEN: z.string().optional()` to the `server` object (build-time only, for source map upload)
    - Add `SENTRY_AUTH_TOKEN: process.env.SENTRY_AUTH_TOKEN` to the `runtimeEnv` object
    - _Requirements: 10.3_

  - [x] 2.4 Add `NEXT_PUBLIC_SENTRY_DEBUG` to `packages/env/src/web.ts` client section
    - Add `NEXT_PUBLIC_SENTRY_DEBUG: z.string().optional().transform((v) => v === "true" || v === "1")` to the `client` object
    - Add `NEXT_PUBLIC_SENTRY_DEBUG: process.env.NEXT_PUBLIC_SENTRY_DEBUG` to the `runtimeEnv` object
    - _Requirements: 10.4_

  - [ ]* 2.5 Write unit tests for T3 Env schema additions
    - Verify that the new Sentry vars are accepted by the schema with valid values
    - Verify that missing required vars cause validation errors listing the missing variable names
    - _Requirements: 10.1, 10.2, 10.3, 10.4, 10.5_

- [x] 3. Checkpoint — Verify schema and config changes
  - Ensure all tests pass, ask the user if questions arise.

- [x] 4. Verify `vercel.json` preview deployment configuration
  - [x] 4.1 Verify `apps/web/vercel.json` and `apps/server/vercel.json` allow preview deployments
    - Confirm `git.deploymentEnabled.main` is `false` (production via hooks only) and no other branches are disabled
    - Confirm `ignoreCommand` skips Dependabot and Renovate branches but allows all other feature branches
    - Add inline comments or documentation if the config is already correct (no code changes needed if current config is valid)
    - _Requirements: 3.1, 4.1, 4.2, 4.3, 4.4_

- [x] 5. Domain configuration map and CORS documentation
  - [x] 5.1 Create domain configuration map module
    - Create `packages/env/src/domains.ts` with the `DOMAIN_MAP` constant mapping each `VercelEnvironment` to `{ web, server, docs }` URLs
    - Production: `doji.bet`, `api.doji.bet`, `docs.doji.bet`
    - Preview: `staging.doji.bet`, `staging-api.doji.bet`, `staging-docs.doji.bet`
    - Development: `localhost:3000`, `localhost:3001`, `localhost:3002`
    - Export the `CORS_ORIGINS` per-environment configuration alongside the domain map
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 2.1, 2.2, 2.3_

  - [ ]* 5.2 Write property test for Domain Map completeness (Property 1)
    - **Property 1: Domain Map Completeness** — For any Vercel environment in {production, preview, development} and for any app in {web, server, docs}, the Domain_Map must define a non-empty, valid URL.
    - **Validates: Requirement 1.1**

  - [ ]* 5.3 Write property test for CORS validity (Property 3)
    - **Property 3: CORS Validity** — For any Vercel environment, every origin in the CORS_ORIGIN value must be a valid URL containing protocol and host only (no path, query, or fragment), the origins array must contain at least one entry, and no origin may be the wildcard `*`.
    - **Validates: Requirements 2.4, 2.5, 2.7**

  - [ ]* 5.4 Write property test for CORS parsing round-trip (Property 4)
    - **Property 4: CORS Parsing Round-Trip** — For any valid comma-separated URL string accepted by the T3 Env CORS_ORIGIN transform, parsing it into an array of URLs and joining the array back with commas must produce the original string.
    - **Validates: Requirement 2.6**

- [x] 6. Sentry environment tagging configuration
  - [x] 6.1 Document `SENTRY_ENVIRONMENT` per-deployment values
    - Add `SENTRY_ENVIRONMENT` to the domain map module with values: `"production"` for production, `"staging"` for preview, `"development"` for development
    - Ensure the value is set explicitly per environment (not relying on `NODE_ENV` fallback)
    - _Requirements: 8.1, 8.2, 8.3, 8.4_

- [x] 7. Environment variable audit script
  - [x] 7.1 Create the audit script at `scripts/vercel-env-audit.ts`
    - Implement the `auditEnvVars()` function that:
      - Accepts `--app` (web | server) and `--env` (production | preview | development) CLI args
      - Shells out to `vercel env ls` to fetch remote env var keys for the specified app and environment
      - Parses the local `.env.local` or `.env` file for the specified app
      - Classifies every key into exactly one of: `matched`, `missingLocal`, `missingRemote`, `valueMismatch`
      - Masks sensitive var values in all output (only prints key names and status)
      - Exits with descriptive error if Vercel CLI is not authenticated
      - Exits with descriptive error if local `.env` file does not exist
    - _Requirements: 7.1, 7.2, 7.3, 7.4, 7.5, 7.6, 11.2_

  - [ ]* 7.2 Write property test for audit classification partition (Property 7)
    - **Property 7: Audit Classification Partition** — For any set of remote env var keys R and local env var keys L, the audit diff algorithm must classify every key in R ∪ L into exactly one of: `matched`, `missingLocal`, `missingRemote`, or `valueMismatch`. The four result arrays must form a complete, disjoint partition of R ∪ L.
    - Use `fast-check` to generate arbitrary `Record<string, string>` for remote and local var sets, then verify the partition property
    - **Validates: Requirement 7.3**

  - [ ]* 7.3 Write property test for audit sensitive value masking (Property 8)
    - **Property 8: Audit Sensitive Value Masking** — For any audit report output and for any env var marked as sensitive, the audit output must contain only the key name and match/mismatch status — the sensitive value must never appear in the output.
    - **Validates: Requirements 7.4, 11.2**

  - [ ]* 7.4 Write unit tests for audit script edge cases
    - Test: unauthenticated Vercel CLI exits with descriptive error
    - Test: missing `.env` file exits with descriptive error
    - Test: empty remote and local sets produce empty results
    - _Requirements: 7.5, 7.6_

- [x] 8. Checkpoint — Verify audit script and domain map
  - Ensure all tests pass, ask the user if questions arise.

- [x] 9. Package.json script updates
  - [x] 9.1 Add `vercel:env:audit` script to root `package.json`
    - Add `"vercel:env:audit": "npx tsx scripts/vercel-env-audit.ts"` to the `scripts` section
    - _Requirements: 7.1_

- [x] 10. Documentation updates
  - [x] 10.1 Update `packages/env/AGENTS.md` with new Sentry vars and domain map
    - Document the four new T3 Env entries (`SENTRY_DEBUG`, `SENTRY_RELEASE`, `SENTRY_AUTH_TOKEN`, `NEXT_PUBLIC_SENTRY_DEBUG`)
    - Document the domain configuration map module (`packages/env/src/domains.ts`)
    - Document per-environment CORS_ORIGIN values
    - _Requirements: 10.1, 10.2, 10.3, 10.4, 1.1, 2.1, 2.2, 2.3_

  - [x] 10.2 Update `.env.example` files
    - Update root `.env.example` with new Sentry vars and `SENTRY_ENVIRONMENT`
    - Remove stale vars (`SITE_PASSWORD`, `DATABASE_URL_UNPOOLED`) from `.env.example` if present
    - Add per-environment CORS_ORIGIN example values as comments
    - _Requirements: 6.1, 6.2, 8.1, 10.1, 10.2, 10.3, 10.4_

- [x] 11. Final checkpoint — Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation
- Property tests validate universal correctness properties from the design document (Properties 1, 3–8)
- Unit tests validate specific examples and edge cases
- The `vercel.json` files already have the correct `main: false` config — task 4 is a verification step
- Sensitive var marking in Vercel (Requirement 11.1) is a dashboard operation, not a code task — excluded per coding-tasks-only constraint
- Database isolation (Requirement 9) is a Vercel/Neon configuration, not a code task — excluded
- Env var resolution priority (Requirements 12.1–12.3) is enforced by existing T3 Env + Vercel platform behavior — no new code needed
