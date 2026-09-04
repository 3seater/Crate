import type { Timeframe } from "@doji/types";
import { create } from "zustand";

interface BasketTerminalState {
  activeTokens: string[];
  setTimeframe: (tf: Timeframe) => void;
  timeframe: Timeframe;
  toggleToken: (symbol: string) => void;
}

export const useBasketTerminalStore = create<BasketTerminalState>((set) => ({
  timeframe: "24H",
  activeTokens: [],
  setTimeframe: (tf) => set({ timeframe: tf }),
  toggleToken: (symbol) =>
    set((state) => ({
      activeTokens: state.activeTokens.includes(symbol)
        ? state.activeTokens.filter((t) => t !== symbol)
        : [...state.activeTokens, symbol],
    })),
}));
