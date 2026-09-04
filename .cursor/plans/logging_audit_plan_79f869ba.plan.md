---
name: Logging Audit Plan
overview: Audit of the Doji codebase against the logging-best-practices and review-logging-patterns skills, scoped to application code. Findings cover wide events, request context, console usage, generic errors, and optional improvements (environment context, drain pipeline).
todos: []
isProject: false
---

# Logging Audit Plan

Audit is scoped to **application code** in `apps/`, `packages/` (excluding `.agents/skills/` templates and Playwright skill run scripts).

---

## Summary: Current State vs Skill Criteria


| Criterion                          | Status      | Notes                                                                                                               |
| ---------------------------------- | ----------- | ------------------------------------------------------------------------------------------------------------------- |
| Single logger                      | **OK**      | One `@doji/logger` (Pino server, client no-op); used in server, web, api                                            |
| Request-scoped logger              | **OK**      | Hono creates `logger.child({ requestId, method, path })`, passed to tRPC as `ctx.log`                               |
| Structured JSON / redaction        | **OK**      | Pino JSON in prod, redact paths for password/token/authorization                                                    |
| Wide event (one per request)       | **Partial** | HTTP layer logs once (status, duration); tRPC logs per procedure; no single accumulated event with business context |
| Business context in events         | **Gap**     | Routers do not add user/business fields to a shared event                                                           |
| Environment context                | **Partial** | Logger `base` has `service`, `env`; no commit_hash, version, region                                                 |
| No console.* in app code           | **Gaps**    | 3 places in app code (see below)                                                                                    |
| Structured errors (why, fix, link) | **Gap**     | Many `throw new Error(...)` / TRPCError with message only                                                           |
| Routers using ctx.log              | **Gap**     | auth.ts uses root `logger` instead of `ctx.log`                                                                     |


---

## 1. What’s Already Aligned

- **[packages/logger](packages/logger/src/index.ts)**: Single Pino logger, JSON in production, `redact` for sensitive fields, `base: { service, env }`.
- **[apps/server/src/app.ts](apps/server/src/app.ts)**: Request-scoped logger created in first middleware (`requestId`, `method`, `path`), set on Hono context and passed to tRPC `createContext` as `log`. Second middleware logs one line per request: `{ status, duration }`.
- **[packages/api/src/middleware/logger.ts](packages/api/src/middleware/logger.ts)**: tRPC middleware uses `ctx.log ?? logger`, logs procedure `path`, `type`, `duration`, `status`, and truncated result/error. Uses request-scoped logger when available.
- **Client**: [packages/logger/src/client.ts](packages/logger/src/client.ts) used in web app; dev-only console forwarding, no-op in production.
- **Context**: [packages/api/src/context.ts](packages/api/src/context.ts) and server app pass `log` from Hono into tRPC context.

---

## 2. Console Usage in Application Code

Replace with shared logger (or keep dev-only but via logger) for consistency and filtering.


| Location                                                                        | Current                                                        | Recommendation                                                                                                                                                |
| ------------------------------------------------------------------------------- | -------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [apps/web/src/utils/trpc.ts](apps/web/src/utils/trpc.ts) L91                    | `console.error(\`[tRPC] ${op.path}:, msg)` in dev              | Use `logger.error` from `@doji/logger/client` with structured object `{ path: op.path, message: msg }` so it’s consistent and can be toggled.                 |
| [apps/server/src/lib/rate-limiter.ts](apps/server/src/lib/rate-limiter.ts) L294 | `console.warn(\`[rate-limiter] Unknown source "${source}"...)` | Accept an optional `Logger` (or use `@doji/logger` root logger) and call `logger.warn({ source, family: 'general' }, 'Unknown rate-limit source, fallback')`. |
| [packages/db/src/baseline.ts](packages/db/src/baseline.ts) L38–62               | `console.log` / `console.error` in CLI                         | Either keep as-is (CLI stdout) or inject/use `@doji/logger` for consistency; lower priority.                                                                  |
| [packages/db/src/migrate.ts](packages/db/src/migrate.ts) L30–51                 | Same as above                                                  | Same as baseline; optional normalization.                                                                                                                     |


**Priority**: trpc.ts and rate-limiter.ts (server/app); db scripts are lower priority.

---

## 3. Wide Events and Business Context

Skills: one context-rich event per request; high cardinality (requestId, userId) and business context (e.g. subscription, outcome).

- **Current**: HTTP middleware logs `{ status, duration }`; tRPC middleware logs per procedure `{ path, type, duration, status, resultPreview }`. RequestId is in the child logger, so both logs are correlated by requestId.
- **Gap**: There is no single “wide” event per request that accumulates method, path, requestId, userId (when authed), procedure path/type, business fields (e.g. order side, market slug), and outcome in one object emitted at request end.

**Options (pick one direction):**

- **A) Keep current shape, enrich only**: Keep one HTTP log + one tRPC log per procedure. Add optional business context in tRPC middleware (e.g. from `ctx.session`) so procedure logs include `userId` / `issuer` when present. No new “single wide event” abstraction.
- **B) Single wide event per request**: Implement a “wide event” buffer on Hono context (or similar) that middleware and procedures can append to; one middleware at the end of the request serializes and logs that object (with duration, status, path, requestId, user, procedure, and any business fields). tRPC middleware could add procedure path/type/result to that buffer instead of (or in addition to) its own log line.

Recommendation: **A** for minimal change and immediate gain; **B** if you want to fully align with “one event per request” and are willing to add a small request-scoped accumulator.

---

## 4. Routers Using Request-Scoped Logger

- **[apps/server/src/routers/auth.ts](apps/server/src/routers/auth.ts) L258**: Uses root `logger.error({ error }, "Failed to verify Safe address on-chain")` instead of `ctx.log`. So this error is not tagged with the request’s `requestId` in the same way as other tRPC logs.

**Recommendation**: Use `ctx.log` when available (e.g. `const log = ctx.log ?? logger`), then `log.error({ error }, "Failed to verify Safe address on-chain")` so the log is request-correlated.

---

## 5. Generic / Unstructured Errors

Skills: Prefer structured errors with `message`, `status`, `why`, `fix`, `link` (and optionally `cause`) for user-facing and operational clarity.

**Current**: Many places use `throw new Error("...")` or `throw new TRPCError({ code, message })` with no `why`/`fix`/`link`. Examples (application code only):

- [apps/web](apps/web): place-order-client, magic (auth.ts, provider, signer), use-deploy-safe, safe-onboarding, order-form.hooks
- [apps/server](apps/server): clob-read, clob router, validate-config, polymarket (gamma, data)
- [packages/api](packages/api): builder, clob-factory, clob client

**Recommendation**:  

- **Short term**: For critical user-facing flows (e.g. auth, onboarding, place order), add structured fields where tRPC/client can surface them: e.g. extend TRPCError with a custom `meta` (or use a shared error type) with `why`, `fix`, `link`. Frontend can then show message + why + fix/link (e.g. in toasts).  
- **Long term**: Introduce a small `createAppError({ message, code, status, why?, fix?, link?, cause? })` that normalizes to TRPCError (or Hono HTTP error) and use it in routers and shared libs; document in code standards.

No need to adopt “evlog” or Nuxt-specific APIs; the principle is “structured, self-documenting errors” in your existing stack.

---

## 6. Environment / Deployment Context

Skills: Include commit hash, service version, region, instance ID in events for correlation with deployments.

- **Current**: [packages/logger](packages/logger/src/index.ts) `base` has `service`, `env` only.
- **Gap**: No `version`, `commit`, `region`, or `instanceId`.

**Recommendation**: Add to logger `base` (or to the request-scoped child where relevant) from env or build-time vars, e.g. `SERVICE_VERSION`, `COMMIT_SHA`, `REGION`, `INSTANCE_ID`. Optional; high value in production for debugging after deploys.

---

## 7. Client Logger Usage

- **Current**: Web app uses `@doji/logger/client` with `logger.error`, `logger.warn`, `logger.debug` with mixed string and object arguments. No “wide event” accumulation (evlog-style) and no client→server log transport.
- **Assessment**: Client logging is dev-friendly and not noisy in prod. Skills’ “evlog” transport and drain pipeline are Nuxt-oriented; for Doji (Next.js + Hono), optional future work could be: (1) standardize client log calls to always pass an object as first argument for structure, and (2) if desired, add an optional ingest API and server-side drain (e.g. OTLP or Axiom) for client logs. Not required for this audit.

---

## 8. Log Draining and Pipelines

Skills suggest adapters (Axiom, OTLP, etc.) and a drain pipeline (batching, retry, backoff) for production.

- **Current**: Pino logs to stdout; no explicit drain or external adapter.
- **Recommendation**: Document that in production, stdout is consumed by the host (Vercel, Docker, etc.) and can be forwarded to Datadog/OTLP/Axiom via the platform or a sidecar. If you add a custom drain (e.g. direct Axiom ingest), then batching/retry (pipeline) is recommended; otherwise, “stdout + platform forward” is acceptable.

---

## 9. Suggested Implementation Order

1. **Quick wins**: Replace `console.error` in [apps/web/src/utils/trpc.ts](apps/web/src/utils/trpc.ts) with client logger; replace `console.warn` in [apps/server/src/lib/rate-limiter.ts](apps/server/src/lib/rate-limiter.ts) with server logger (or inject a logger).
2. **Request correlation**: In [apps/server/src/routers/auth.ts](apps/server/src/routers/auth.ts), use `ctx.log ?? logger` for the Safe verification error.
3. **Optional**: Add minimal business context to tRPC logger (e.g. `userId`/`issuer` from session when present).
4. **Optional**: Add env/deployment fields to logger `base` (version, commit, region) and consider a single wide-event per request (option A vs B above).
5. **Structured errors**: Introduce a small convention (TRPCError `meta` or `createAppError`) and use it in 1–2 critical flows (e.g. auth, place order); then expand.

---

## 10. Out of Scope for This Audit

- `.agents/skills/` templates (examples only).
- Playwright skill `run.js` / helpers (test tooling).
- [packages/logger/src/client.ts](packages/logger/src/client.ts) implementation detail (using console in dev is acceptable; no change unless you standardize on structured object-only calls).

