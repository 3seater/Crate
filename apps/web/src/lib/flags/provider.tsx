"use client";

import { createContext, use } from "react";

type FlagValues = Record<string, boolean>;
const FlagContext = createContext<FlagValues>({});

/**
 * Provides server-evaluated flag values to client components via context.
 * Seed in root layout to avoid client-side flag evaluation.
 */
export function FlagProvider({
  values,
  children,
}: {
  values: FlagValues;
  children: React.ReactNode;
}) {
  return <FlagContext value={values}>{children}</FlagContext>;
}

/** Read a flag value in a client component. Returns false if flag is not set. */
export function useFlag(key: string): boolean {
  return use(FlagContext)[key] ?? false;
}
