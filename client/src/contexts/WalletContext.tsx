"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { getApiErrorMessage, getStoredAuthToken } from "@/lib/api";
import { getMyWallet, type WalletBalanceSummary } from "@/lib/wallet";
import { SILENT_POLL_INTERVAL_MS } from "@/hooks/useSilentPoll";

export interface RefreshWalletOptions {
  /** When true, update balances in place without toggling full-page loaders. */
  silent?: boolean;
}

interface WalletContextValue {
  wallet: WalletBalanceSummary | null;
  isLoading: boolean;
  error: string | null;
  refreshWallet: (options?: RefreshWalletOptions) => Promise<WalletBalanceSummary | null>;
}

const WalletContext = createContext<WalletContextValue | null>(null);

export function WalletProvider({ children }: { children: React.ReactNode }) {
  const [wallet, setWallet] = useState<WalletBalanceSummary | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inFlightRef = useRef(false);

  const refreshWallet = useCallback(async (options?: RefreshWalletOptions) => {
    const silent = options?.silent === true;

    if (!getStoredAuthToken()) {
      setWallet(null);
      setError(null);
      setIsLoading(false);
      return null;
    }

    if (inFlightRef.current && silent) {
      return null;
    }

    inFlightRef.current = true;

    if (!silent) {
      setIsLoading(true);
      setError(null);
    }

    try {
      const response = await getMyWallet();
      setWallet(response.data);
      setError(null);
      return response.data;
    } catch (err) {
      // Silent polls keep the last known-good wallet to avoid flicker.
      if (!silent) {
        setError(getApiErrorMessage(err, "Failed to load wallet balance."));
      }
      return null;
    } finally {
      inFlightRef.current = false;
      if (!silent) {
        setIsLoading(false);
      }
    }
  }, []);

  // Initial load + silent 10s polling while authenticated.
  useEffect(() => {
    void refreshWallet({ silent: false });

    const timerId = window.setInterval(() => {
      if (typeof document !== "undefined" && document.visibilityState === "hidden") {
        return;
      }
      if (!getStoredAuthToken()) {
        return;
      }
      void refreshWallet({ silent: true });
    }, SILENT_POLL_INTERVAL_MS);

    function onVisibilityChange() {
      if (document.visibilityState === "visible" && getStoredAuthToken()) {
        void refreshWallet({ silent: true });
      }
    }

    document.addEventListener("visibilitychange", onVisibilityChange);

    return () => {
      window.clearInterval(timerId);
      document.removeEventListener("visibilitychange", onVisibilityChange);
    };
  }, [refreshWallet]);

  const value = useMemo(
    () => ({ wallet, isLoading, error, refreshWallet }),
    [wallet, isLoading, error, refreshWallet]
  );

  return <WalletContext.Provider value={value}>{children}</WalletContext.Provider>;
}

export function useWallet(): WalletContextValue {
  const context = useContext(WalletContext);
  if (!context) {
    throw new Error("useWallet must be used within WalletProvider");
  }
  return context;
}
