/**
 * Server-side flag exports. Imports Edge Config adapter (uses "use cache").
 * Client Components must import from "@/lib/flags/client" instead.
 */
export {
  FLAG_REGISTRY,
  featureFunnels,
  featureReferrals,
  opsBridge,
  opsClob,
  opsMagic,
  opsRtds,
  opsSafeDeploy,
  opsSports,
  opsWebSocket,
} from "./definitions";
export { isTradingEnabled } from "./guards";
export { FlagProvider, useFlag } from "./provider";
export type { FlagMeta, FlagType } from "./types";
