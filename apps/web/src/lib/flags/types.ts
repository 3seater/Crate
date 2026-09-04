export type FlagType = "release" | "ops" | "experiment" | "permission";

export interface FlagMeta {
  description: string;
  /** ISO date — required for release + experiment flags. */
  expectedRemoval?: string;
  key: string;
  /** Owner responsible for cleanup. */
  owner?: string;
  type: FlagType;
}
