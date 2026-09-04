"use client";

import {
  darkTheme,
  getDefaultConfig,
  RainbowKitProvider,
} from "@rainbow-me/rainbowkit";
import "@rainbow-me/rainbowkit/styles.css";
import { QueryClientProvider } from "@tanstack/react-query";
import { domAnimation, LazyMotion } from "framer-motion";
import { NuqsAdapter } from "nuqs/adapters/next/app";
import { Suspense } from "react";
import { WagmiProvider } from "wagmi";
import { robinhoodChain } from "@/config/chains";
import { WalletSyncProvider } from "@/domains/baskets/components/wallet-sync-provider";
import { queryClient } from "@/lib/trpc";
import { TopLoadingBar } from "@/shell/top-loading-bar";
import { Toaster } from "@/ui/sonner";
import { TooltipProvider } from "@/ui/tooltip";

const wagmiConfig = getDefaultConfig({
  appName: "Crate",
  projectId: "b56e18d47c72ab683b10814fe9495694", // free public demo key — replace with your own at cloud.reown.com
  chains: [robinhoodChain],
  ssr: true,
});

const rainbowTheme = {
  ...darkTheme({
    accentColor: "#f0a56a",
    accentColorForeground: "#0d0b09",
    borderRadius: "small",
    fontStack: "system",
    overlayBlur: "none",
  }),
  colors: {
    ...darkTheme().colors,
    // Modals + popovers
    modalBackground: "#15100d",
    modalBorder: "#302721",
    modalText: "#fff5eb",
    modalTextDim: "#a79c92",
    modalTextSecondary: "#a79c92",
    // Connected account button
    connectButtonBackground: "#15100d",
    connectButtonBackgroundError: "#15100d",
    connectButtonInnerBackground: "#0d0b09",
    connectButtonText: "#fff5eb",
    connectButtonTextError: "#f0a56a",
    // Action buttons inside modal
    actionButtonBorder: "#302721",
    actionButtonBorderMobile: "#302721",
    actionButtonSecondaryBackground: "#1a120f",
    // General
    accentColor: "#f0a56a",
    accentColorForeground: "#0d0b09",
    menuItemBackground: "#1a120f",
    profileAction: "#1a120f",
    profileActionHover: "#251a16",
    profileForeground: "#15100d",
    selectedOptionBorder: "#f0a56a",
    closeButton: "#a79c92",
    closeButtonBackground: "#1a120f",
    error: "#f0a56a",
    generalBorder: "#302721",
    generalBorderDim: "#251a16",
  },
};

export default function Providers({ children }: { children: React.ReactNode }) {
  return (
    <LazyMotion features={domAnimation} strict>
      <NuqsAdapter>
        <TooltipProvider delay={300}>
          <WagmiProvider config={wagmiConfig}>
            <QueryClientProvider client={queryClient}>
              <RainbowKitProvider theme={rainbowTheme}>
                <Suspense fallback={null}>
                  <TopLoadingBar />
                </Suspense>
                <WalletSyncProvider>{children}</WalletSyncProvider>
              </RainbowKitProvider>
            </QueryClientProvider>
          </WagmiProvider>
          <Toaster richColors />
        </TooltipProvider>
      </NuqsAdapter>
    </LazyMotion>
  );
}
