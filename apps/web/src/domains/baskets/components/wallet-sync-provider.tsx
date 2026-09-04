"use client";

import { useEffect } from "react";
import { useAccount } from "wagmi";
import { useWalletStore } from "@/stores/wallet";

export function WalletSyncProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const { address, chainId, isConnected } = useAccount();
  const { setConnected, setDisconnected, setChainId } = useWalletStore();

  useEffect(() => {
    if (isConnected && address && chainId) {
      setConnected(address, chainId);
    } else {
      setDisconnected();
    }
  }, [isConnected, address, chainId, setConnected, setDisconnected]);

  useEffect(() => {
    if (chainId) {
      setChainId(chainId);
    }
  }, [chainId, setChainId]);

  return <>{children}</>;
}
