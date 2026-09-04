import { create } from "zustand";
import { persist } from "zustand/middleware";

interface PreferencesState {
  /** When true, portfolio/cash/PnL values show as •••• */
  hideBalances: boolean;
  toggleHideBalances: () => void;
}

export const usePreferencesStore = create<PreferencesState>()(
  persist(
    (set) => ({
      hideBalances: false,
      toggleHideBalances: () => set((s) => ({ hideBalances: !s.hideBalances })),
    }),
    { name: "doji-preferences" }
  )
);

export const CENSOR_PLACEHOLDER = "****";
