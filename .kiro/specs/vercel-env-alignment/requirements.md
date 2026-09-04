# Requirements Document

## Introduction

This document specifies the requirements for establishing a complete environment alignment strategy for the Doji monorepo across three Vercel deployment targets: Production (`main` branch), Preview/Staging (feature branches), and Development (local). The requirements ensure every environment variable is correctly set per environment, CORS origins match the domain scheme, branch-based deployments route correctly, Turborepo cache keys stay aligned with T3 Env schemas, and developers can audit and sync env vars using the Vercel CLI.

## Glossary

- **Vercel_Environment**: One of `"production"`, `"preview"`, or `"development"` as defined by the Vercel platform
- **Domain_Map**: A centralized mapping of Vercel_Environment to domain URLs for each Vercel project (web, server, docs)
- **T3_Env_Schema**: The Zod-based environment variable validation schemas in `packages/env/src/server.ts` and `packages/env/src/web.ts`
- **Turbo_Build_Env**: The set of environment variable keys listed in `turbo.json` under `globalEnv` and `tasks.build.env`
- **CORS_Origin**: A comma-separated string of allowed browser origins for the server CORS middleware
- **Deploy_Hook**: A Vercel webhook URL triggered by GitHub Actions to initiate a production deployment
- **Preview_Deployment**: A Vercel deployment triggered by the Git integration for non-main branches
- **Audit_Script**: A CLI tool that compares local `.env` files against Vercel-stored environment variables
- **Audit_Report**: The output of the Audit_Script containing per-app diff results (matched, missing, mismatched keys)
- **Sensitive_Var**: An environment variable marked as sensitive in Vercel, hidden from dashboard readback after creation
- **Neon_Branch**: A database branch in Neon, providing isolated Postgres instances for different environments
- **Stale_Var**: An environment variable listed in Turbo_Build_Env or Vercel that is no longer used by application code or T3_Env_Schema

## Requirements

### Requirement 1: Environment-Specific Domain Configuration

**User Story:** As a developer, I want a centralized domain configuration map, so that every app resolves the correct URLs for its deployment environment.

#### Acceptance Criteria

1. THE Domain_Map SHALL define `web`, `server`, and `docs` URLs for each Vercel_Environment (production, preview, development)
2. WHEN the Vercel_Environment is `"production"`, THE Domain_Map SHALL resolve web to `https://doji.bet`, server to `https://api.doji.bet`, and docs to `https://docs.doji.bet`
3. WHEN the Vercel_Environment is `"preview"`, THE Domain_Map SHALL resolve web to `https://staging.doji.bet`, server to `https://staging-api.doji.bet`, and docs to `https://staging-docs.doji.bet`
4. WHEN the Vercel_Environment is `"development"`, THE Domain_Map SHALL resolve web to `http://localhost:3000`, server to `http://localhost:3001`, and docs to `http://localhost:3002`
5. WHEN the web project is deployed, THE `NEXT_PUBLIC_SERVER_URL` value SHALL equal the Domain_Map server URL for the active Vercel_Environment
6. WHEN the web project is deployed, THE `NEXT_PUBLIC_APP_URL` value SHALL equal the Domain_Map web URL for the active Vercel_Environment

### Requirement 2: Per-Environment CORS Configuration

**User Story:** As a developer, I want CORS origins configured per environment, so that the API server accepts requests only from the correct web domains.

#### Acceptance Criteria

1. WHEN the Vercel_Environment is `"production"`, THE server `CORS_ORIGIN` SHALL include `https://doji.bet` and `https://www.doji.bet`
2. WHEN the Vercel_Environment is `"preview"`, THE server `CORS_ORIGIN` SHALL include `https://staging.doji.bet`, `https://doji.bet`, and `https://www.doji.bet`
3. WHEN the Vercel_Environment is `"development"`, THE server `CORS_ORIGIN` SHALL include `http://localhost:3000` and `http://127.0.0.1:3000`
4. THE CORS_Origin value SHALL consist of comma-separated valid URLs, each containing protocol and host only (no path, query, or fragment)
5. THE CORS_Origin value SHALL contain at least one origin for every Vercel_Environment
6. THE CORS_Origin value SHALL parse correctly through the T3_Env_Schema `CORS_ORIGIN` transform into an array of valid URL strings
7. THE CORS_Origin value SHALL NOT include a wildcard (`*`) origin in any Vercel_Environment

### Requirement 3: Production Deployment via Deploy Hooks

**User Story:** As a DevOps engineer, I want production deployments to trigger exclusively via GitHub Actions deploy hooks, so that production releases are controlled and auditable.

#### Acceptance Criteria

1. THE `vercel.json` file in each Vercel project (web, server, docs) SHALL set `git.deploymentEnabled.main` to `false`
2. WHEN a commit is pushed to the `main` branch, THE `deploy.yml` GitHub Actions workflow SHALL trigger deploy hooks for all three Vercel projects (web, server, docs)
3. THE `deploy.yml` workflow SHALL use concurrency grouping to prevent overlapping production deployments
4. IF a deploy hook request fails, THEN THE GitHub Actions workflow SHALL report the failure in the workflow run status

### Requirement 4: Preview Deployments for Feature Branches

**User Story:** As a developer, I want feature branches to automatically deploy to preview environments, so that I can test changes before merging to main.

#### Acceptance Criteria

1. WHEN a non-main branch is pushed, THE Vercel Git integration SHALL trigger a preview deployment for each affected Vercel project
2. THE `vercel.json` files SHALL NOT disable deployments for non-main branches
3. WHEN a preview deployment builds, THE Vercel platform SHALL load Preview-scoped environment variables from the Vercel env store
4. THE `ignoreCommand` in each `vercel.json` SHALL skip builds for Dependabot and Renovate branches

### Requirement 5: Turborepo Cache Key Alignment

**User Story:** As a developer, I want Turborepo cache keys to include all environment variables that affect build output, so that changing an env var busts the cache and prevents stale builds.

#### Acceptance Criteria

1. THE Turbo_Build_Env SHALL include every env var key validated by the T3_Env_Schema (the set of T3 Env keys must be a subset of Turbo_Build_Env)
2. THE `turbo.json` `globalEnv` SHALL include `VERCEL_URL` in addition to the existing `NODE_ENV`, `CI`, `VERCEL`, and `VERCEL_ENV`
3. THE Turbo_Build_Env SHALL include `SENTRY_AUTH_TOKEN` for source map upload cache correctness
4. THE Turbo_Build_Env SHALL NOT include Stale_Vars: `SITE_PASSWORD`, `DATABASE_URL_UNPOOLED`, and `POSTGRES_PRISMA_URL`

### Requirement 6: Stale Environment Variable Cleanup

**User Story:** As a developer, I want retired environment variables removed from configuration files, so that the codebase does not reference unused vars.

#### Acceptance Criteria

1. THE `turbo.json` `tasks.build.env` array SHALL NOT contain `SITE_PASSWORD`
2. THE `turbo.json` `tasks.build.env` array SHALL NOT contain `DATABASE_URL_UNPOOLED` (replaced by `DATABASE_URL_DIRECT`)
3. THE `turbo.json` `tasks.build.env` array SHALL NOT contain `POSTGRES_PRISMA_URL` (Prisma-specific, not applicable to Drizzle)
4. WHEN a Stale_Var is identified in the Vercel env store, THE developer SHALL remove the Stale_Var from the Vercel project settings

### Requirement 7: Environment Variable Audit Tooling

**User Story:** As a developer, I want a CLI audit script that diffs local `.env` files against Vercel-stored env vars, so that I can detect missing, extra, or mismatched variables.

#### Acceptance Criteria

1. WHEN the Audit_Script runs for a given app and Vercel_Environment, THE Audit_Script SHALL fetch env vars from the Vercel env store for that environment
2. WHEN the Audit_Script runs, THE Audit_Script SHALL parse the local `.env.local` or `.env` file for the specified app
3. THE Audit_Script SHALL classify every key in the union of remote and local env var sets into exactly one category: `matched`, `missingLocal`, `missingRemote`, or `valueMismatch`
4. THE Audit_Script SHALL NOT print sensitive env var values in the Audit_Report — only key names and match/mismatch status
5. IF the Vercel CLI is not authenticated, THEN THE Audit_Script SHALL exit with a descriptive authentication error
6. IF the local `.env` file does not exist for the specified app, THEN THE Audit_Script SHALL exit with a descriptive file-not-found error

### Requirement 8: Sentry Environment Tagging

**User Story:** As a developer, I want Sentry events tagged with the correct environment, so that production errors are distinguishable from staging and development errors.

#### Acceptance Criteria

1. WHEN the Vercel_Environment is `"production"`, THE `SENTRY_ENVIRONMENT` env var SHALL be set to `"production"`
2. WHEN the Vercel_Environment is `"preview"`, THE `SENTRY_ENVIRONMENT` env var SHALL be set to `"staging"`
3. WHEN the Vercel_Environment is `"development"`, THE `SENTRY_ENVIRONMENT` env var SHALL be set to `"development"`
4. THE `SENTRY_ENVIRONMENT` value SHALL be set explicitly in the Vercel env store for both the web and server projects (not relying on fallback to `NODE_ENV`)

### Requirement 9: Database Isolation

**User Story:** As a developer, I want production and preview environments to use separate database branches, so that preview deployments do not corrupt production data.

#### Acceptance Criteria

1. THE production Vercel_Environment SHALL use a `DATABASE_URL` pointing to the Neon production (main) branch
2. THE preview Vercel_Environment SHALL use a `DATABASE_URL` pointing to a separate Neon preview branch
3. THE production `DATABASE_URL` value SHALL differ from the preview `DATABASE_URL` value

### Requirement 10: T3 Env Schema Completeness

**User Story:** As a developer, I want all environment variables used in application code to be validated by T3 Env schemas, so that missing or malformed vars are caught at build time rather than runtime.

#### Acceptance Criteria

1. THE `packages/env/src/web.ts` T3_Env_Schema SHALL include a validation entry for `SENTRY_DEBUG` (currently accessed via raw `process.env` in Sentry config files)
2. THE `packages/env/src/web.ts` T3_Env_Schema SHALL include a validation entry for `SENTRY_RELEASE` (currently accessed via raw `process.env` in Sentry config files)
3. THE `packages/env/src/web.ts` T3_Env_Schema SHALL include a validation entry for `SENTRY_AUTH_TOKEN` (currently accessed via raw `process.env` in `next.config.ts`)
4. THE `packages/env/src/web.ts` T3_Env_Schema SHALL include a validation entry for `NEXT_PUBLIC_SENTRY_DEBUG` (currently accessed via raw `process.env` in `instrumentation-client.ts`)
5. WHEN a required env var is missing at build time, THE T3_Env_Schema validation SHALL fail with an error message listing the missing variable names

### Requirement 11: Sensitive Variable Protection

**User Story:** As a security engineer, I want sensitive environment variables marked as sensitive in Vercel, so that secret values are hidden from dashboard readback after creation.

#### Acceptance Criteria

1. THE following env vars SHALL be marked as sensitive in the Vercel env store: `MAGIC_SECRET_KEY`, `CREDENTIAL_ENCRYPTION_KEY`, `JWT_SESSION_SECRET`, `POLYMARKET_BUILDER_ID`, `POLYMARKET_BUILDER_SIGNING_KEY`, `POLYMARKET_BUILDER_PASSPHRASE`, `DATABASE_URL`, `DATABASE_URL_DIRECT`, `POLYMARKET_SIGN_TOKENS`, `DISCORD_OPS_WEBHOOK_URL`, `DISCORD_BUG_REPORT_WEBHOOK_URL`, `SENTRY_AUTH_TOKEN`
2. THE Audit_Script SHALL identify sensitive vars by key name and mask their values in all output
3. IF a production secret is shared with the preview environment, THEN THE developer SHALL evaluate whether a separate credential is available for preview use

### Requirement 12: Environment Variable Resolution

**User Story:** As a developer, I want a clear resolution priority for environment variables, so that the correct value is always used regardless of where it is defined.

#### Acceptance Criteria

1. THE env var resolution SHALL follow this priority order: Vercel env store (per-environment) first, then local `.env.local` file (development only), then T3_Env_Schema default value
2. IF a required env var has no value at any resolution level, THEN THE system SHALL throw an error identifying the missing variable, the Vercel_Environment, and the app
3. THE T3_Env_Schema `emptyStringAsUndefined` option SHALL be enabled, so that empty string values are treated as undefined
