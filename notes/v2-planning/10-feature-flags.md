# 10 — Feature Flag Architecture

> Phase 0 · ~3 days · No dependencies · Low risk

Replace static `NEXT_PUBLIC_FEATURE_*` env vars with Vercel Flags SDK + Edge Config for runtime toggling, kill switches, and experiment support.

---

## 1. Current State

Two flags in `apps/web/src/shared/config/feature-flags.ts`, backed by `NEXT_PUBLIC_FEATURE_*` env vars:

```ts
export const featureFlags = {
  referrals: env.NEXT_PUBLIC_FEATURE_REFERRALS,
  funnels: env.NEXT_PUBLIC_FEATURE_FUNNELS ?? false,
} as const;
```

**8 call sites across 5 files:**

| File | Flag | Usage |
|---|---|---|
| `app/referrals/page.tsx` | `referrals` | Gate entire page (redirect if off) |
| `layout/header-nav.tsx` | `referrals` | Show/hide nav link |
| `app/leaderboard/leaderboard-page.tsx` | `funnels` | 4 call sites — funnel columns + controls |
| `features/explore/components/events-discovery.tsx` | `funnels` | Funnel filter toggle |
| `features/explore/components/markets-loading-skeleton.tsx` | `funnels` | Skeleton column count |

**Problems:**

- Static at build time — changing requires redeployment
- No runtime toggling, no user/segment targeting
- No server-side evaluation (flags leak to client bundle)
- No kill switches for external dependencies (CLOB, bridge, Magic, etc.)
- No flag lifecycle management or expiry enforcement

---

## 2. Tool Choice: Vercel Flags SDK + Edge Config

**Why this stack:**

- **Framework-native** — designed for Next.js App Router, evaluates server-side (no client flicker)
- **Edge Config** — sub-1ms reads at the edge, no cold starts, no external service dependency
- **Vercel Toolbar** — flag overrides in preview deployments without code changes
- **Zero infrastructure** — managed by Vercel, no self-hosted service

**Alternatives rejected:**

| Tool | Reason |
|---|---|
| LaunchDarkly | Enterprise pricing ($$$), overkill for our flag count |
| PostHog | Would add a third analytics layer alongside Vercel Analytics + Sentry |
| Unleash | Another service to host and maintain |
| Keep env vars only | Can't change without redeploy, no kill switches |

---

## 3. Flag Types

| Type | Lifetime | Naming | Example |
|---|---|---|---|
| **Release** | Temporary (30-day removal rule) | `feature.{name}` | `feature.referrals`, `feature.funnels` |
| **Ops / Kill switch** | Permanent | `ops.{service}.enabled` | `ops.clob.enabled`, `ops.bridge.enabled` |
| **Experiment** | Temporary | `experiment.{name}` | `experiment.pricing-page` |
| **Permission** | Permanent | `permission.{capability}` | `permission.advanced-charts` |

---

## 4. File Structure

```
apps/web/src/lib/flags/
├── types.ts           # FlagType, FlagMeta, FlagKey
├── definitions.ts     # All flag declarations + FLAG_REGISTRY
├── provider.tsx       # "use client" FlagProvider + useFlag hook
├── index.ts           # Re-exports
└── audit.ts           # CI script for expired flags
```

---

## 5. Flag Definitions

### types.ts

```ts
export type FlagType = "release" | "ops" | "experiment" | "permission";

export interface FlagMeta {
  key: string;
  type: FlagType;
  description: string;
  /** ISO date — required for release + experiment flags. */
  expectedRemoval?: string;
  /** Owner responsible for cleanup. */
  owner?: string;
}
```

### definitions.ts — Feature flags (Edge Config)

Feature flags read from Edge Config for runtime toggling without redeploy:

```ts
import { flag } from "flags/next";
import { edgeConfigAdapter } from "@flags-sdk/edge-config";

// --- Release flags (Edge Config) ---

export const featureReferrals = flag<boolean>({
  key: "feature.referrals",
  defaultValue: false,
  adapter: edgeConfigAdapter(),
  description: "User referral program: /referrals and related surfaces.",
});

export const featureFunnels = flag<boolean>({
  key: "feature.funnels",
  defaultValue: false,
  adapter: edgeConfigAdapter(),
  description: "Explore/leaderboard table funnel controls.",
});
```

### definitions.ts — Ops kill switches (env vars)

Kill switches use env vars, **not** Edge Config. Rationale: if Edge Config itself is down, kill switches must still work. Env vars are baked into the runtime and always available.

```ts
import { env } from "@doji/env/web";

// --- Ops kill switches (env vars — survive Edge Config outage) ---

const envFlag = (key: string, envValue: boolean | undefined, description: string) =>
  flag<boolean>({
    key,
    defaultValue: true, // ops flags default ON (service enabled)
    decide: () => envValue ?? true,
    description,
  });

export const opsClob = envFlag(
  "ops.clob.enabled",
  env.NEXT_PUBLIC_OPS_CLOB_ENABLED,
  "CLOB order placement and orderbook fetches.",
);

export const opsBridge = envFlag(
  "ops.bridge.enabled",
  env.NEXT_PUBLIC_OPS_BRIDGE_ENABLED,
  "USDC deposit/withdraw bridge flows.",
);

export const opsWebSocket = envFlag(
  "ops.websocket.enabled",
  env.NEXT_PUBLIC_OPS_WEBSOCKET_ENABLED,
  "Market + user WebSocket connections.",
);

export const opsRtds = envFlag(
  "ops.rtds.enabled",
  env.NEXT_PUBLIC_OPS_RTDS_ENABLED,
  "Real-time data service WebSocket.",
);

export const opsSports = envFlag(
  "ops.sports.enabled",
  env.NEXT_PUBLIC_OPS_SPORTS_ENABLED,
  "Sports WebSocket channel.",
);

export const opsMagic = envFlag(
  "ops.magic.enabled",
  env.NEXT_PUBLIC_OPS_MAGIC_ENABLED,
  "Magic SDK initialization and email/OAuth login.",
);

export const opsSafeDeploy = envFlag(
  "ops.safe-deploy.enabled",
  env.NEXT_PUBLIC_OPS_SAFE_DEPLOY_ENABLED,
  "Gnosis Safe deployment during onboarding.",
);
```

### definitions.ts — Flag Registry

```ts
export const FLAG_REGISTRY: FlagMeta[] = [
  // Release
  { key: "feature.referrals", type: "release", description: "Referral program", expectedRemoval: "2026-06-01", owner: "product" },
  { key: "feature.funnels", type: "release", description: "Funnel controls", expectedRemoval: "2026-06-01", owner: "product" },
  // Ops (permanent — no expectedRemoval)
  { key: "ops.clob.enabled", type: "ops", description: "CLOB trading" },
  { key: "ops.bridge.enabled", type: "ops", description: "Bridge flows" },
  { key: "ops.websocket.enabled", type: "ops", description: "Market/user WS" },
  { key: "ops.rtds.enabled", type: "ops", description: "RTDS WS" },
  { key: "ops.sports.enabled", type: "ops", description: "Sports WS" },
  { key: "ops.magic.enabled", type: "ops", description: "Magic SDK" },
  { key: "ops.safe-deploy.enabled", type: "ops", description: "Safe deployment" },
];
```

---

## 6. Consumption Patterns

### Server Components — direct await

```tsx
// app/referrals/page.tsx
import { featureReferrals } from "@/lib/flags";

export default async function ReferralsPage() {
  if (!(await featureReferrals())) redirect("/explore");
  return <ReferralsContent />;
}
```

### Client Components — useFlag hook

```tsx
// provider.tsx
"use client";

import { createContext, use } from "react";

type FlagValues = Record<string, boolean>;
const FlagContext = createContext<FlagValues>({});

export function FlagProvider({
  values,
  children,
}: {
  values: FlagValues;
  children: React.ReactNode;
}) {
  return <FlagContext value={values}>{children}</FlagContext>;
}

export function useFlag(key: string): boolean {
  return use(FlagContext)[key] ?? false;
}
```

```tsx
// Client component usage
"use client";
import { useFlag } from "@/lib/flags";

function NavLinks() {
  const referralsEnabled = useFlag("feature.referrals");
  if (!referralsEnabled) return null;
  return <Link href="/referrals">Referrals</Link>;
}
```

### Root layout — seed FlagProvider

```tsx
// app/layout.tsx
import { featureReferrals, featureFunnels, opsClob, opsBridge } from "@/lib/flags";
import { FlagProvider } from "@/lib/flags/provider";

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const flagValues = {
    "feature.referrals": await featureReferrals(),
    "feature.funnels": await featureFunnels(),
    "ops.clob.enabled": await opsClob(),
    "ops.bridge.enabled": await opsBridge(),
  };

  return (
    <FlagProvider values={flagValues}>
      {children}
    </FlagProvider>
  );
}
```

### Kill switch guard — isTradingEnabled()

```ts
// lib/flags/guards.ts
import { opsClob, opsMagic, opsSafeDeploy } from "./definitions";

export async function isTradingEnabled(): Promise<boolean> {
  return (await opsClob()) && (await opsMagic()) && (await opsSafeDeploy());
}
```

---

## 7. Kill Switch Inventory

| Kill switch | Key | What it disables | Fallback behavior |
|---|---|---|---|
| **CLOB** | `ops.clob.enabled` | Order placement, orderbook fetches, price history | Show stale cached prices, disable order form with "Trading temporarily unavailable" |
| **Bridge** | `ops.bridge.enabled` | USDC deposit/withdraw flows | Hide bridge UI, show maintenance banner |
| **WebSocket** | `ops.websocket.enabled` | Market + user WS connections | Fall back to polling via TanStack Query refetchInterval |
| **RTDS** | `ops.rtds.enabled` | Real-time data service WS | Degrade to REST polling for live data |
| **Sports** | `ops.sports.enabled` | Sports WebSocket channel | Hide sports-specific real-time features |
| **Magic** | `ops.magic.enabled` | Magic SDK init, email/OAuth login | Show "Login temporarily unavailable", wallet login still works |
| **Safe deploy** | `ops.safe-deploy.enabled` | Gnosis Safe deployment in onboarding | Queue onboarding, show "Account setup delayed" |

---

## 8. Flag Audit (CI)

### scripts/flag-audit.ts

```ts
import { FLAG_REGISTRY } from "../apps/web/src/lib/flags/definitions";

const now = new Date();
const expired: string[] = [];

for (const flag of FLAG_REGISTRY) {
  if (!flag.expectedRemoval) continue;
  if (new Date(flag.expectedRemoval) < now) {
    expired.push(`${flag.key} (expired ${flag.expectedRemoval}, owner: ${flag.owner ?? "unassigned"})`);
  }
}

if (expired.length > 0) {
  console.error("❌ Expired feature flags — remove before merging:\n");
  for (const msg of expired) console.error(`  • ${msg}`);
  process.exit(1);
}

console.log(`✅ ${FLAG_REGISTRY.length} flags checked, none expired.`);
```

### package.json

```json
{
  "scripts": {
    "flag-audit": "tsx scripts/flag-audit.ts"
  }
}
```

### CI integration (.github/workflows/ci.yml)

Add after the lint step:

```yaml
- name: Flag audit
  run: pnpm flag-audit
```

---

## 9. Cleanup Rules

### 30-day removal rule

Every `release` and `experiment` flag must have an `expectedRemoval` date set at creation time, no more than 30 days from merge. The CI audit (§8) enforces this — expired flags fail the build.

### Removal checklist

When removing a flag:

1. Delete the flag definition from `definitions.ts`
2. Remove the entry from `FLAG_REGISTRY`
3. Remove all call sites (grep for the flag key)
4. Delete dead code paths (the `false` branch is now unreachable)
5. Remove from `FlagProvider` seed in root layout
6. Remove from Edge Config store (Vercel dashboard)
7. Remove env var from `.env.example` and `packages/env` (ops flags only)
8. Update tests that reference the flag

### Quarterly audit target

Keep total non-permanent flags (release + experiment) under **15**. Review quarterly — if over 15, schedule a cleanup sprint before adding new flags.

---

## 10. Edge Config Structure

Edge Config store JSON shape (Vercel dashboard → Edge Config → Items):

```json
{
  "feature.referrals": false,
  "feature.funnels": false
}
```

Ops flags are **not** stored in Edge Config — they use env vars (see §5). Only `release`, `experiment`, and `permission` flags go in Edge Config.

As flags are added:

```json
{
  "feature.referrals": true,
  "feature.funnels": false,
  "experiment.pricing-page": true,
  "permission.advanced-charts": false
}
```

---

## 11. Migration Steps

### Step 1: Install dependencies

```bash
pnpm add flags @flags-sdk/edge-config --filter=web
```

### Step 2: Connect Edge Config

1. Vercel dashboard → Project Settings → Edge Config
2. Create or link an Edge Config store
3. Vercel auto-injects `EDGE_CONFIG` connection string

### Step 3: Create lib/flags/ files

Create the 4 files from §4–5:
- `types.ts` — FlagType, FlagMeta
- `definitions.ts` — flag declarations + FLAG_REGISTRY
- `provider.tsx` — FlagProvider + useFlag
- `index.ts` — re-exports

### Step 4: Migrate existing flags (5 files, 8 call sites)

| File | Before | After |
|---|---|---|
| `app/referrals/page.tsx` | `featureFlags.referrals` | `await featureReferrals()` |
| `layout/header-nav.tsx` | `featureFlags.referrals` | `useFlag("feature.referrals")` |
| `app/leaderboard/leaderboard-page.tsx` (×4) | `featureFlags.funnels` | `useFlag("feature.funnels")` |
| `features/explore/components/events-discovery.tsx` | `featureFlags.funnels` | `useFlag("feature.funnels")` |
| `features/explore/components/markets-loading-skeleton.tsx` | `featureFlags.funnels` | `useFlag("feature.funnels")` |

After migration, delete `apps/web/src/shared/config/feature-flags.ts` and remove `NEXT_PUBLIC_FEATURE_REFERRALS` / `NEXT_PUBLIC_FEATURE_FUNNELS` from `packages/env/src/web.ts`.

### Step 5: Add ops kill switches

1. Add `NEXT_PUBLIC_OPS_*` env vars to `packages/env/src/web.ts` (all optional, default `true`)
2. Add to `.env.example` files
3. Wire kill switch checks into trading guard, bridge UI, WebSocket manager

### Step 6: Add flag audit to CI

1. Create `scripts/flag-audit.ts` (§8)
2. Add `"flag-audit"` script to root `package.json`
3. Add step to `.github/workflows/ci.yml`

---

## 12. Timeline

| Day | Work |
|---|---|
| **Day 1** | Install deps, create `lib/flags/` files, connect Edge Config, migrate 2 existing flags (8 call sites) |
| **Day 2** | Add 7 ops kill switches, wire into trading guard + WebSocket manager + bridge UI |
| **Day 3** | Flag audit script, CI integration, delete old `feature-flags.ts`, test in preview deployment |

**Risk:** Low. Flags default to current behavior (referrals off, funnels off, ops all on). Migration is mechanical — same boolean checks, different source. Edge Config failure falls back to `defaultValue`. Ops flags use env vars so they survive any Vercel service issue.
