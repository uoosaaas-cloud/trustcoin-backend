"use client";

import { WalletProvider } from "@/contexts/WalletContext";
import { DevToolsGuard } from "@/components/DevToolsGuard";
import { ToastProvider } from "@/components/ToastProvider";

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <ToastProvider>
      <WalletProvider>
        <DevToolsGuard />
        {children}
      </WalletProvider>
    </ToastProvider>
  );
}
