---
name: Logging usage audit
overview: "Full audit of logging across the codebase: fix the one console.* violation, normalize Pino call style for structured logs (object-first, err in context), align with Datadog reserved/standard attributes and naming, and document CLI/test exceptions."
todos: []
isProject: false
---

# Logging usage audit

## Scope

- **In scope:** [apps/web](apps/web), [apps/server](apps/server), [packages/api](packages/api), [packages/logger](packages/logger). All files that import and use logging.
- **Out of scope:** `.agents/skills/` (templates only), `node_modules`. **Documented exceptions:** [packages/db](packages/db) CLI scripts ([baseline.ts](packages/db/src/baseline.ts), [migrate.ts](packages/db/src/migrate.ts)) and test files may use `console.*` for CLI output or test debugging; code standards apply to production app code.

## Current state

- **Logger usage:** 30+ files use `@doji/logger` (server) or `@doji/logger/client` (browser). Imports are correct: server/router/API routes and Next.js Server Components use `@doji/logger`; client components, hooks, and browser lib use `@doji/logger/client`.
- **Request context:** [apps/server/src/app.ts](apps/server/src/app.ts) creates a request-scoped child logger (`requestId`, `method`, `path`); [packages/api/src/middleware/logger.ts](packages/api/src/middleware/logger.ts) uses `ctx.log` when available and logs procedure path, duration, and result preview (with sanitization of `ctx`).
- **No `debugger` or `alert()`** in app code.

---

## 1. Fix code-standards violation (required)

**Rule:** [.agents/code-standards.md](.agents/code-standards.md) — "No `console.log`, `debugger`, or `alert` in production code."

| Location                                                                            | Issue                                                               | Fix                                                                                                                    |
| ----------------------------------------------------------------------------------- | ------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| [apps/web/src/lib/websocket/rtds.ts](apps/web/src/lib/websocket/rtds.ts) (line 339) | `console.warn("[RTDS] handler threw:", err)` inside `dispatchEvent` | Replace with `logger.warn({ err }, "[RTDS] handler threw")`. File already imports `logger` from `@doji/logger/client`. |

This is the only `console.`* in production app code under `apps/`.

---

## 2. Optional: Normalize Pino call style for structured logs

**Convention:** Pino (and [packages/logger/AGENTS.md](packages/logger/AGENTS.md)) use **object-first** for structured context: `logger.info({ key: value }, "message")`. That ensures fields are indexed and queryable in Datadog. Several calls use **message-first** or pass an error as a second positional arg; normalizing improves consistency and searchability.

**Candidates to normalize** (object-first, include `err` in object when applicable):

- [apps/web/src/lib/trading/find-safe-address.ts](apps/web/src/lib/trading/find-safe-address.ts) (line 72): `logger.error("Failed to query Polygonscan:", error)` → `logger.error({ err: error }, "Failed to query Polygonscan")`.
- [apps/web/src/hooks/use-clob-client.ts](apps/web/src/hooks/use-clob-client.ts) (line 108): `logger.warn("Failed to persist credentials for future sessions", err)` → `logger.warn({ err }, "Failed to persist credentials for future sessions")`.
- [apps/web/src/components/error-fallback.tsx](apps/web/src/components/error-fallback.tsx) (lines 32–35): Already passes an object; swap to `logger.error({ title, message: error.message, digest: error.digest }, "Error boundary caught")`.
- [apps/web/src/components/onboarding/safe-onboarding.tsx](apps/web/src/components/onboarding/safe-onboarding.tsx): Multiple `logger.error("...", err)` / `logger.warn("...", err)` — change to `logger.error({ err }, "message")` (and same for warn) so `err` is a structured field.
- [apps/web/src/lib/websocket/manager.ts](apps/web/src/lib/websocket/manager.ts) (line 183): `logger.error("[WebSocket] Error connecting to", url)` → `logger.error({ url }, "[WebSocket] Error connecting to")`.
- [apps/web/src/lib/websocket/sports-channel.ts](apps/web/src/lib/websocket/sports-channel.ts), [market-channel.ts](apps/web/src/lib/websocket/market-channel.ts), [user-channel.ts](apps/web/src/lib/websocket/user-channel.ts): Any `logger.warn("...", err)` → `logger.warn({ err }, "...")`.

Apply the same pattern elsewhere where an error or context object is passed as a second argument instead of inside the first object. No need to change calls that already use `logger.info({ ... }, "msg")` or `logger.error({ err }, "msg")`.

---

## 3. Documentation and exceptions

- **packages/db:** Add a short comment at the top of [packages/db/src/baseline.ts](packages/db/src/baseline.ts) and [packages/db/src/migrate.ts](packages/db/src/migrate.ts) that `console.log` / `console.error` are intentional for CLI user output. Optionally add one sentence in [packages/db](packages/db) AGENTS.md or README that CLI scripts use console for stdout/stderr.
- **WebSocket AGENTS.md:** In [apps/web/src/lib/websocket/AGENTS.md](apps/web/src/lib/websocket/AGENTS.md), the example code blocks (e.g. "Handle market update", sports handler) use `console.log`. Update those examples to use `logger` from `@doji/logger/client` so docs match the "no console in production code" standard.
- **type-guards.ts:** [apps/web/src/utils/type-guards.ts](apps/web/src/utils/type-guards.ts) uses `console.log` only inside JSDoc `@example` blocks (not executed). Optional: change examples to `logger.debug(...)` for consistency; low priority.

---

## 4. Datadog alignment

Logging should follow [Datadog’s attributes and naming conventions](https://docs.datadoghq.com/logs/log_configuration/attributes_naming_convention) and [default standard attributes](https://docs.datadoghq.com/standard-attributes/) so logs are searchable, facetable, and consistent with pipelines/APM.

**Already in place (no change):**

- **Reserved attributes** — [packages/logger/src/datadog-stream.ts](packages/logger/src/datadog-stream.ts) sends `message`, `status`, `timestamp`, `host`, `service` (via ddtags), `trace_id`, `span_id`, `ddsource`; logger base provides `service`, `env`, `version` (unified service tagging).
- **Request context** — Hono and tRPC middleware log `duration` (Datadog’s default measure for trace search) and request identifiers.

**Apply during this audit:**

- **Object-first, structured context** — Use `logger.level({ ...context }, "message")` so every field is a JSON attribute and becomes a Datadog facet. Avoid `logger.level("message", obj)` so the object is not lost or mis-parsed. This matches section 2 (normalize Pino call style).
- **Error attribute** — Put errors in the context object as `err` (or `error`) so they are indexed. Use `logger.error({ err }, "message")` consistently. Our stream and pipelines can remap `err` to standard `error.`* in Datadog if needed.
- **Duration** — For any new log lines that include request/operation duration, use the attribute name `duration` (number, e.g. milliseconds or nanoseconds per [standard attributes](https://docs.datadoghq.com/standard-attributes/) — we use ms in middleware).
- **Standard attribute names where applicable** — For HTTP, user, or error context use Datadog’s standard paths when it’s trivial (e.g. `duration`, `http.url_details.path` in app logs if already available). Custom names (`requestId`, `path`, `procedure`) are fine; consistency matters more than renaming everything.
- **No PII in message string** — Keep the message short and stable; put identifiers (user id, address, etc.) in the context object so they can be redacted or aliased. Logger already redacts known sensitive paths; avoid logging tokens or emails in the message text.

**References:** [Attributes and aliasing](https://docs.datadoghq.com/logs/log_configuration/attributes_naming_convention), [Standard attributes](https://docs.datadoghq.com/standard-attributes/), [Log pipelines / processors](https://docs.datadoghq.com/logs/log_configuration/processors/).

---

## 5. Verification checklist (no code change)

- **Server vs client logger:** Confirmed — Server Components and API routes use `@doji/logger`; all client-side code under `apps/web` (components, hooks, lib) uses `@doji/logger/client`.
- **Sensitive data:** Logger redaction is configured in [packages/logger/src/index.ts](packages/logger/src/index.ts). tRPC logger middleware strips `ctx` from result preview in [packages/api/src/middleware/logger.ts](packages/api/src/middleware/logger.ts). No additional redaction changes required from this audit.
- **Tests:** [tests/integration/gamma.test.ts](tests/integration/gamma.test.ts) uses `console.error` for schema validation errors during test runs. Acceptable for test debugging; optional to replace with a test logger or leave as-is.

---

## Summary

| Priority          | Action                                                                                                                                 |
| ----------------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| **Required**      | Replace `console.warn` in [rtds.ts](apps/web/src/lib/websocket/rtds.ts) with `logger.warn({ err }, "message")`.                        |
| **Recommended**   | Normalize Pino calls to object-first in the listed files; use `err` in context for errors (aligns with Datadog structured attributes). |
| **Datadog**       | Same normalization ensures context fields become facets; use `duration` for timings; keep PII in context object, not message string.   |
| **Documentation** | Note CLI exception in packages/db; update WebSocket AGENTS.md examples to use logger.                                                  |
| **Optional**      | type-guards JSDoc examples; gamma.test.ts console.error.                                                                               |

No new tooling or config is required. After changes, run `pnpm fix` and `pnpm check-types`.
