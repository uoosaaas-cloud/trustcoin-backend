"use client";

import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useCallback, useEffect, useMemo, useState } from "react";
import { QRCodeSVG } from "qrcode.react";
import { AppNav } from "@/components/AppNav";
import { CopyButton } from "@/components/CopyButton";
import { StatusBadge } from "@/components/StatusBadge";
import { useSilentPoll } from "@/hooks/useSilentPoll";
import { getApiErrorMessage, getStoredAuthToken } from "@/lib/api";
import { formatDateTime } from "@/lib/format";
import {
  getDepositAddress,
  getDepositHistory,
  getDepositNetworks,
  type DepositAddressOption,
  type DepositNetworkCode,
  type DepositNetworkOption,
  type DepositRequestRecord,
} from "@/lib/deposit";
import { useWallet } from "@/contexts/WalletContext";

export default function DepositPage() {
  const router = useRouter();
  const t = useTranslations("deposit");
  const tCommon = useTranslations("common");
  const { refreshWallet } = useWallet();

  const [isAuthChecked, setIsAuthChecked] = useState(false);

  const [networks, setNetworks] = useState<DepositNetworkOption[]>([]);
  const [selectedNetwork, setSelectedNetwork] = useState<DepositNetworkCode | null>(null);
  const [isLoadingNetworks, setIsLoadingNetworks] = useState(true);

  const [addressByNetwork, setAddressByNetwork] = useState<Partial<Record<DepositNetworkCode, DepositAddressOption>>>(
    {}
  );
  const [addressErrorByNetwork, setAddressErrorByNetwork] = useState<Partial<Record<DepositNetworkCode, string>>>({});
  const [addressFetchNonce, setAddressFetchNonce] = useState(0);

  const [history, setHistory] = useState<DepositRequestRecord[]>([]);
  const [isLoadingHistory, setIsLoadingHistory] = useState(true);

  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!getStoredAuthToken()) {
      router.replace("/login?next=/deposit");
      return;
    }
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setIsAuthChecked(true);
  }, [router]);

  useEffect(() => {
    if (!isAuthChecked) {
      return;
    }

    let isMounted = true;

    async function loadNetworks() {
      try {
        const response = await getDepositNetworks();
        if (!isMounted) return;
        setNetworks(response.data);
        setSelectedNetwork((current) => current ?? response.data[0]?.network ?? null);
      } catch (error) {
        if (!isMounted) return;
        setErrorMessage(getApiErrorMessage(error, tCommon("unknownError")));
      } finally {
        if (isMounted) setIsLoadingNetworks(false);
      }
    }

    async function loadHistory() {
      try {
        const response = await getDepositHistory();
        if (!isMounted) return;
        setHistory(response.data);
      } catch (error) {
        if (!isMounted) return;
        setErrorMessage(getApiErrorMessage(error, tCommon("unknownError")));
      } finally {
        if (isMounted) setIsLoadingHistory(false);
      }
    }

    loadNetworks();
    loadHistory();

    return () => {
      isMounted = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAuthChecked]);

  const silentRefreshHistory = useCallback(async () => {
    try {
      const [historyResponse] = await Promise.all([
        getDepositHistory(),
        refreshWallet({ silent: true }),
      ]);
      setHistory(historyResponse.data);
    } catch {
      // Keep last known history — silent polls never flash errors.
    }
  }, [refreshWallet]);

  useSilentPoll(silentRefreshHistory, { enabled: isAuthChecked });

  useEffect(() => {
    if (!isAuthChecked || !selectedNetwork || addressByNetwork[selectedNetwork]) {
      return;
    }

    let isMounted = true;
    const network = selectedNetwork;

    getDepositAddress(network)
      .then((response) => {
        if (!isMounted) return;
        setAddressErrorByNetwork((current) => {
          if (!current[network]) return current;
          const next = { ...current };
          delete next[network];
          return next;
        });
        setAddressByNetwork((current) => ({ ...current, [network]: response.data }));
      })
      .catch((error) => {
        if (!isMounted) return;
        const message = getApiErrorMessage(error, t("errors.addressGeneric"));
        setAddressErrorByNetwork((current) => ({ ...current, [network]: message }));
      });

    return () => {
      isMounted = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAuthChecked, selectedNetwork, addressByNetwork, addressFetchNonce]);

  function handleSelectNetwork(network: DepositNetworkCode) {
    const shouldRetry = !addressByNetwork[network] && Boolean(addressErrorByNetwork[network]);

    setSelectedNetwork(network);

    if (shouldRetry) {
      setAddressErrorByNetwork((current) => {
        const next = { ...current };
        delete next[network];
        return next;
      });
      setAddressFetchNonce((nonce) => nonce + 1);
    }
  }

  const activeNetwork = useMemo(
    () => networks.find((network) => network.network === selectedNetwork) ?? null,
    [networks, selectedNetwork]
  );

  const activeAddress = selectedNetwork ? addressByNetwork[selectedNetwork] ?? null : null;
  const activeAddressError = selectedNetwork ? addressErrorByNetwork[selectedNetwork] ?? null : null;
  const isLoadingActiveAddress = Boolean(selectedNetwork) && !activeAddress && !activeAddressError;

  if (!isAuthChecked) {
    return null;
  }

  return (
    <div className="page-shell flex flex-col">
      <AppNav />

      <main className="relative z-10 mx-auto w-full max-w-3xl flex-1 px-4 pb-16 pt-6 sm:px-6">
        <div className="mb-6">
          <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-cyan-200/90 sm:text-xs">{t("eyebrow")}</p>
          <h1 className="mt-2.5 text-2xl font-bold tracking-tight text-white sm:text-[2rem] sm:leading-tight">{t("title")}</h1>
          <p className="mt-2.5 text-[15px] leading-relaxed text-slate-300">{t("subtitle")}</p>
        </div>

        <section className="card-surface animate-fade-in-up p-6 sm:p-8">
          <div>
            <span className="mb-2 block text-sm font-medium text-slate-300">{t("networkLabel")}</span>
            {isLoadingNetworks ? (
              <div className="h-10 w-full animate-pulse rounded-xl bg-white/10" />
            ) : (
              <div className="flex flex-wrap gap-2">
                {networks.map((network) => (
                  <button
                    key={network.network}
                    type="button"
                    onClick={() => handleSelectNetwork(network.network)}
                    className={`rounded-xl border px-4 py-2 text-sm font-semibold transition ${
                      selectedNetwork === network.network
                        ? "border-cyan-300/40 bg-cyan-400/12 text-cyan-100"
                        : "border-white/14 bg-white/[0.06] text-slate-300 hover:border-cyan-300/30 hover:bg-white/[0.1]"
                    }`}
                  >
                    {network.currency} - {network.network}
                  </button>
                ))}
              </div>
            )}
          </div>

          {activeNetwork && (
            <div className="mt-6 flex flex-col items-center gap-5 rounded-2xl border border-white/14 bg-white/[0.06] p-5 sm:flex-row sm:items-center sm:gap-6">
              {activeAddress ? (
                <>
                  <div className="flex-shrink-0 rounded-2xl bg-white p-3 shadow-md">
                    <QRCodeSVG value={activeAddress.qrPayload} size={128} bgColor="#ffffff" fgColor="#0f172a" />
                  </div>

                  <div className="min-w-0 flex-1 text-center sm:text-start">
                    <p className="text-xs font-semibold uppercase tracking-widest text-slate-400">
                      {t("addressLabel")} · {activeAddress.label}
                    </p>
                    <p
                      dir="ltr"
                      className="mt-2 break-all rounded-xl border border-cyan-300/25 bg-cyan-400/10 px-3 py-2 font-mono text-sm text-cyan-100"
                    >
                      {activeAddress.address}
                    </p>
                    <div className="mt-3 flex justify-center sm:justify-start">
                      <CopyButton value={activeAddress.address} label={t("copy")} copiedLabel={t("copied")} />
                    </div>
                  </div>
                </>
              ) : isLoadingActiveAddress ? (
                <div className="flex w-full flex-col items-center gap-5 sm:flex-row sm:items-center sm:gap-6">
                  <div className="h-[152px] w-[152px] flex-shrink-0 animate-pulse rounded-2xl bg-white/10" />
                  <div className="min-w-0 flex-1 space-y-2">
                    <div className="h-3 w-40 animate-pulse rounded bg-white/10" />
                    <div className="h-8 w-full animate-pulse rounded-xl bg-white/10" />
                  </div>
                </div>
              ) : (
                <p className="w-full text-center text-sm text-rose-300">
                  {activeAddressError ?? t("errors.addressGeneric")}
                </p>
              )}
            </div>
          )}

          <p className="mt-6 text-center text-sm font-medium text-slate-400">
            {t("listeningHint")}
          </p>

          {errorMessage && (
            <div className="mt-4 rounded-xl border border-rose-400/25 bg-rose-500/10 px-3.5 py-2.5 text-sm text-rose-200">
              {errorMessage}
            </div>
          )}
        </section>

        <section className="mt-10">
          <h2 className="mb-4 text-lg font-bold text-white">{t("historyTitle")}</h2>

          <div className="table-surface">
            {isLoadingHistory ? (
              <div className="space-y-2 p-6">
                {[0, 1, 2].map((index) => (
                  <div key={index} className="h-10 animate-pulse rounded-lg bg-white/10" />
                ))}
              </div>
            ) : history.length === 0 ? (
              <p className="p-8 text-center text-sm text-slate-400">{t("historyEmpty")}</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[640px] text-start text-sm">
                  <thead>
                    <tr className="border-b border-white/10 bg-white/[0.06] text-xs uppercase tracking-wide text-slate-400">
                      <th className="px-4 py-3 text-start font-semibold">{t("table.amount")}</th>
                      <th className="px-4 py-3 text-start font-semibold">{t("table.network")}</th>
                      <th className="px-4 py-3 text-start font-semibold">{t("table.status")}</th>
                      <th className="px-4 py-3 text-start font-semibold">{t("table.date")}</th>
                      <th className="px-4 py-3 text-start font-semibold">{t("table.txHash")}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {history.map((deposit) => (
                      <tr key={deposit.id} className="border-b border-white/10 last:border-0 hover:bg-white/[0.06]">
                        <td dir="ltr" className="whitespace-nowrap px-4 py-3 text-start font-semibold text-white">
                          {deposit.amount} {deposit.currency}
                        </td>
                        <td className="whitespace-nowrap px-4 py-3 text-slate-300">{deposit.network}</td>
                        <td className="whitespace-nowrap px-4 py-3">
                          <StatusBadge status={deposit.status} label={t(`status.${deposit.status}`)} />
                        </td>
                        <td className="whitespace-nowrap px-4 py-3 text-slate-400">
                          {formatDateTime(deposit.created_at)}
                        </td>
                        <td className="max-w-[160px] truncate px-4 py-3 font-mono text-xs text-slate-400" dir="ltr">
                          {deposit.sweep_tx_hash ?? deposit.tx_hash ?? "—"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </section>
      </main>
    </div>
  );
}
