"use client";

import {
  darkTheme,
  getDefaultConfig,
  RainbowKitProvider,
} from "@rainbow-me/rainbowkit";
import "@rainbow-me/rainbowkit/styles.css";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { domAnimation, LazyMotion } from "framer-motion";
import { NuqsAdapter } from "nuqs/adapters/next/app";
import { Suspense } from "react";
import { WagmiProvider } from "wagmi";
import { robinhoodChain } from "@/config/chains";
import { WalletSyncProvider } from "@/domains/baskets/components/wallet-sync-provider";
import { registerQueryClient } from "@/lib/session-manager";
import { TopLoadingBar } from "@/shell/top-loading-bar";
import { Toaster } from "@/ui/sonner";
import { TooltipProvider } from "@/ui/tooltip";

const queryClient = new QueryClient({
  defaultOptions: { queries: { staleTime: 30_000, retry: 1 } },
});
registerQueryClient(queryClient);

const wagmiConfig = getDefaultConfig({
  appName: "Crate",
  projectId: "b56e18d47c72ab683b10814fe9495694", // free public demo key — replace with your own at cloud.reown.com
  chains: [robinhoodChain],
  ssr: true,
});

const rainbowTheme = {
  ...darkTheme({
    accentColor: "#a5e200",
    accentColorForeground: "#0b0d09",
    borderRadius: "medium",
    fontStack: "system",
    overlayBlur: "none",
  }),
  colors: {
    ...darkTheme().colors,
    // Modals + popovers
    modalBackground: "#0f120d",
    modalBorder: "rgba(165, 226, 0, 0.12)",
    modalText: "#f0f5e8",
    modalTextDim: "#8a9480",
    modalTextSecondary: "#8a9480",
    // Connected account button
    connectButtonBackground: "rgba(165, 226, 0, 0.08)",
    connectButtonBackgroundError: "rgba(165, 226, 0, 0.05)",
    connectButtonInnerBackground: "rgba(11, 13, 9, 0.8)",
    connectButtonText: "#f0f5e8",
    connectButtonTextError: "#a5e200",
    // Action buttons inside modal
    actionButtonBorder: "rgba(165, 226, 0, 0.15)",
    actionButtonBorderMobile: "rgba(165, 226, 0, 0.15)",
    actionButtonSecondaryBackground: "rgba(165, 226, 0, 0.05)",
    // General
    accentColor: "#a5e200",
    accentColorForeground: "#0b0d09",
    menuItemBackground: "rgba(165, 226, 0, 0.06)",
    profileAction: "rgba(165, 226, 0, 0.06)",
    profileActionHover: "rgba(165, 226, 0, 0.12)",
    profileForeground: "#0f120d",
    selectedOptionBorder: "#a5e200",
    closeButton: "#8a9480",
    closeButtonBackground: "rgba(165, 226, 0, 0.06)",
    error: "#a5e200",
    generalBorder: "rgba(165, 226, 0, 0.12)",
    generalBorderDim: "rgba(165, 226, 0, 0.06)",
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
