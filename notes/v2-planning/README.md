# V2 Migration Planning

> Detailed, actionable specs for migrating Doji from V1 to V2 architecture.
> Each document is self-contained with exact file paths, line counts, and step-by-step instructions.
>
> **Source of truth:** These specs supersede V2.md for implementation details.
> V2.md remains the architectural vision; these docs are the execution plan.

## Codebase Snapshot (2026-05-02)

| Metric | Count |
|--------|-------|
| tRPC routers | 10 (9 files + 1 inline) |
| tRPC procedures | 141 |
| tRPC call sites (web) | 254 across 79 files |
| Zustand stores | 17 (9 client-UI, 7 hybrid, 1 server-mirror) |
| Wallet store consumers | 65 files, 462 matches |
| Router code (total lines) | 6,910 |
| Largest router | trading/router.ts — 2,571 lines (92KB), 55 procedures |
| ethers imports | 18 files |
| date-fns imports | 3 files |
| Error patterns | 102 throw sites (64 TRPCError + 38 createAppError) |

## Document Index

| # | Document | Phase | Risk | Status |
|---|----------|-------|------|--------|
| 00 | [Migration Overview](./00-migration-overview.md) | — | — | 🔴 |
| 01 | [Procedure Mapping](./01-procedure-mapping.md) | 1 | Low | 🔴 |
| 02 | [Router Split Plan](./02-router-split-plan.md) | 1 | Medium | 🔴 |
| 03 | [Session Model](./03-session-model.md) | 2 | High | 🔴 |
| 04 | [State Ownership](./04-state-ownership.md) | 3 | Medium | 🔴 |
| 05 | [Error Model](./05-error-model.md) | 1 | Low | 🔴 |
| 06 | [WebSocket Hub](./06-websocket-hub.md) | 3 | Medium | 🔴 |
| 07 | [Credential Migration](./07-credential-migration.md) | 4 | Critical | 🔴 |
| 08 | [Dependency Migrations](./08-dependency-migrations.md) | 5 | Medium | 🔴 |
| 09 | [Domain Restructure](./09-domain-restructure.md) | 6 | Low | 🔴 |
| 10 | [Feature Flags](./10-feature-flags.md) | 1 | Low | 🔴 |
| 11 | [Packages & Contracts](./11-packages-contract.md) | 1 | Low | 🔴 |
| 12 | [Rendering Architecture](./12-rendering-architecture.md) | 3 | Medium | 🔴 |
| 13 | [Testing Strategy](./13-testing-strategy.md) | 1 | Low | 🔴 |
| 14 | [Component System](./14-component-system.md) | 3 | Medium | 🔴 |
| 15 | [Naming Conventions](./15-naming-conventions.md) | 0 | Low | 🔴 |
| 16 | [Database Changes](./16-database-changes.md) | 0/5 | Low | 🔴 |
| 17 | [API Schema Audit](./17-api-schema-audit.md) | 0–2 | Low | 🔴 |

**Status:** 🔴 Not started · 🟡 In progress · 🟢 Complete

## Phase Overview

```
Phase 0 — Foundations (no user impact)     ← docs 05, 10, 11, 13, 15, 16
Phase 1 — Session Model (highest value)    ← doc 03
Phase 2 — Router Renames (coordinated)     ← docs 01, 02, 17
Phase 3 — State + WS + Rendering           ← docs 04, 06, 12, 14
Phase 4 — Credential Migration (critical)  ← doc 07
Phase 5 — Dependency Migrations            ← docs 08, 16
Phase 6 — Domain Restructure (cosmetic)    ← doc 09
```

**Cross-cutting:** docs 00 (overview), 15 (naming), 17 (API schema) apply across all phases.

## How to Use These Docs

1. Read **00-migration-overview.md** first for the full phase plan and risk assessment
2. Each numbered doc is a self-contained spec — read the one relevant to your current phase
3. Every doc includes: current state, target state, exact file changes, rollback plan, and verification steps
4. File paths are relative to repo root unless noted
5. Line counts and procedure counts are from the 2026-05-02 survey — re-verify if the codebase has changed significantly
