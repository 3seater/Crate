import { create } from "zustand";
import { persist } from "zustand/middleware";

export interface WalletState {
  address: string | null;
  chainId: number | null;
  isConnected: boolean;
}

interface WalletActions {
  setChainId: (chainId: number) => void;
  setConnected: (address: string, chainId: number) => void;
  setDisconnected: () => void;
}

const initialState: WalletState = {
  address: null,
  chainId: null,
  isConnected: false,
};

export const useWalletStore = create<WalletState & WalletActions>()(
  persist(
    (set) => ({
      ...initialState,
      setConnected: (address, chainId) =>
        set({ address, chainId, isConnected: true }),
      setDisconnected: () => set(initialState),
      setChainId: (chainId) => set({ chainId }),
    }),
    {
      name: "wallet-storage",
      partialize: (state) => ({
        address: state.address,
        isConnected: state.isConnected,
        chainId: state.chainId,
      }),
    }
  )
);
