/**
 * Client-safe flag exports. Does NOT import definitions.ts (which uses Edge Config / "use cache").
 * Client Components use useFlag() from the provider — flags are seeded server-side.
 */
export { FlagProvider, useFlag } from "./provider";
export type { FlagMeta, FlagType } from "./types";
