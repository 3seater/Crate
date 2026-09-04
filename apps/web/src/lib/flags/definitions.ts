/**
 * Feature flag definitions — SERVER-ONLY.
 *
 * This module imports @flags-sdk/edge-config which uses "use cache" internally.
 * It CANNOT be imported from Client Components. Client Components use
 * useFlag() from "@/lib/flags/client" instead.
 */

import "server-only";

import { flag } from "flags/next";

import type { FlagMeta } from "./types";

// Only create the adapter when EDGE_CONFIG is available (Vercel production/preview).
// In local dev or CI without Edge Config, flags fall back to defaultValue.
// biome-ignore lint/suspicious/noExplicitAny: adapter type from dynamic require doesn't match flag generic
const edgeAdapter: any = process.env.EDGE_CONFIG
  ? (
      require("@flags-sdk/edge-config") as typeof import("@flags-sdk/edge-config")
    ).edgeConfigAdapter()
  : undefined;

const BOOLEAN_OPTIONS = [
  { value: false, label: "Off" },
  { value: true, label: "On" },
];

// ─── Release Flags (Edge Config) ─────────────────────────────────────────────

export const featureReferrals = edgeAdapter
  ? flag<boolean>({
      key: "feature.referrals",
      defaultValue: false,
      options: BOOLEAN_OPTIONS,
      adapter: edgeAdapter,
      description: "User referral program: /referrals and related surfaces.",
    })
  : flag<boolean>({
      key: "feature.referrals",
      defaultValue: false,
      options: BOOLEAN_OPTIONS,
      decide: () => false,
      description: "User referral program: /referrals and related surfaces.",
    });

export const featureFunnels = edgeAdapter
  ? flag<boolean>({
      key: "feature.funnels",
      defaultValue: false,
      options: BOOLEAN_OPTIONS,
      adapter: edgeAdapter,
      description: "Explore/leaderboard table funnel controls.",
    })
  : flag<boolean>({
      key: "feature.funnels",
      defaultValue: false,
      options: BOOLEAN_OPTIONS,
      decide: () => false,
      description: "Explore/leaderboard table funnel controls.",
    });

// ─── Ops Kill Switches (env vars — survive Edge Config outage) ───────────────
// Default: enabled (true). Set env var to "false" to disable.

const envFlag = (
  key: string,
  envVar: string | undefined,
  description: string
) =>
  flag<boolean>({
    key,
    defaultValue: true,
    options: BOOLEAN_OPTIONS,
    decide: () => envVar !== "false",
    description,
  });

export const opsClob = envFlag(
  "ops.clob.enabled",
  process.env.OPS_CLOB_ENABLED,
  "CLOB order placement and orderbook fetches."
);

export const opsBridge = envFlag(
  "ops.bridge.enabled",
  process.env.OPS_BRIDGE_ENABLED,
  "USDC deposit/withdraw bridge flows."
);

export const opsWebSocket = envFlag(
  "ops.websocket.enabled",
  process.env.OPS_WEBSOCKET_ENABLED,
  "Market + user WebSocket connections."
);

export const opsRtds = envFlag(
  "ops.rtds.enabled",
  process.env.OPS_RTDS_ENABLED,
  "Real-time data service WebSocket."
);

export const opsSports = envFlag(
  "ops.sports.enabled",
  process.env.OPS_SPORTS_ENABLED,
  "Sports WebSocket channel."
);

export const opsMagic = envFlag(
  "ops.magic.enabled",
  process.env.OPS_MAGIC_ENABLED,
  "Magic SDK initialization and email/OAuth login."
);

export const opsSafeDeploy = envFlag(
  "ops.safe-deploy.enabled",
  process.env.OPS_SAFE_DEPLOY_ENABLED,
  "Gnosis Safe deployment during onboarding."
);

// ─── Registry (for audit script) ────────────────────────────────────────────

export const FLAG_REGISTRY: FlagMeta[] = [
  {
    key: "feature.referrals",
    type: "release",
    description: "Referral program",
    expectedRemoval: "2026-06-01",
    owner: "product",
  },
  {
    key: "feature.funnels",
    type: "release",
    description: "Funnel controls",
    expectedRemoval: "2026-06-01",
    owner: "product",
  },
  { key: "ops.clob.enabled", type: "ops", description: "CLOB trading" },
  { key: "ops.bridge.enabled", type: "ops", description: "Bridge flows" },
  { key: "ops.websocket.enabled", type: "ops", description: "Market/user WS" },
  { key: "ops.rtds.enabled", type: "ops", description: "RTDS WS" },
  { key: "ops.sports.enabled", type: "ops", description: "Sports WS" },
  { key: "ops.magic.enabled", type: "ops", description: "Magic SDK" },
  {
    key: "ops.safe-deploy.enabled",
    type: "ops",
    description: "Safe deployment",
  },
];
