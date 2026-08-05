"use client";

import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useCallback, useEffect, useMemo, useState } from "react";
import { AppNav } from "@/components/AppNav";
import { AuthLoading } from "@/components/AuthLoading";
import { StatusBadge } from "@/components/StatusBadge";
import { WithdrawalOtpModal } from "@/components/WithdrawalOtpModal";
import { useToast } from "@/components/ToastProvider";
import { useWallet } from "@/contexts/WalletContext";
import { useSilentPoll } from "@/hooks/useSilentPoll";
import { getApiErrorMessage, getStoredAuthToken } from "@/lib/api";
import { getStoredUser } from "@/lib/auth";
import { formatUsdt, formatDateTime } from "@/lib/format";
import {
  createWithdrawal,
  listMyTransactions,
  type TransactionRecord,
  type TransactionStatus,
} from "@/lib/transactions";
import {
  isValidWithdrawAddress,
  WITHDRAW_NETWORKS,
  type WithdrawNetwork,
} from "@/lib/withdrawNetworks";

export default function WithdrawPage() {
  const router = useRouter();
  const t = useTranslations("withdraw");
  const tCommon = useTranslations("common");
  const { pushToast } = useToast();
  const { wallet, isLoading: isLoadingWallet, refreshWallet } = useWallet();

  const [isAuthChecked, setIsAuthChecked] = useState(false);
  const [history, setHistory] = useState<TransactionRecord[]>([]);
  const [isLoadingHistory, setIsLoadingHistory] = useState(true);

  const [amount, setAmount] = useState("");
  const [network, setNetwork] = useState<WithdrawNetwork>("TRC20");
  const [paymentAddress, setPaymentAddress] = useState("");
  const [note, setNote] = useState("");

  const [showOtpModal, setShowOtpModal] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const availableBalance = wallet?.availableBalance ?? "0";
  const availableNum = useMemo(() => Number(availableBalance), [availableBalance]);
  const userEmail = getStoredUser()?.email;

  useEffect(() => {
    if (!getStoredAuthToken()) {
      router.replace("/login?next=/withdraw");
      return;
    }
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setIsAuthChecked(true);
  }, [router]);

  useEffect(() => {
    if (!isAuthChecked) return;

    let isMounted = true;

    async function loadHistory() {
      try {
        const response = await listMyTransactions();
        if (!isMounted) return;
        setHistory(response.data.filter((tx) => tx.type === "WITHDRAWAL"));
      } catch (error) {
        if (!isMounted) return;
        setErrorMessage(getApiErrorMessage(error, tCommon("unknownError")));
      } finally {
        if (isMounted) setIsLoadingHistory(false);
      }
    }

    void refreshWallet({ silent: true });
    loadHistory();

    return () => {
      isMounted = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAuthChecked]);

  const silentRefreshWithdrawals = useCallback(async () => {
    try {
      const [txRes] = await Promise.all([
        listMyTransactions(),
        refreshWallet({ silent: true }),
      ]);
      setHistory(txRes.data.filter((tx) => tx.type === "WITHDRAWAL"));
    } catch {
      // Preserve last known withdrawal statuses during silent refresh.
    }
  }, [refreshWallet]);

  useSilentPoll(silentRefreshWithdrawals, { enabled: isAuthChecked });

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setErrorMessage(null);
    setSuccessMessage(null);

    const trimmedAmount = amount.trim();
    const trimmedAddress = paymentAddress.trim();
    const amountNum = Number(trimmedAmount);

    if (!trimmedAmount || Number.isNaN(amountNum) || amountNum <= 0) {
      setErrorMessage(t("errors.amountRequired"));
      return;
    }

    if (amountNum > availableNum) {
      setErrorMessage(t("errors.exceedsAvailable", { available: formatUsdt(availableBalance) }));
      return;
    }

    if (!isValidWithdrawAddress(network, trimmedAddress)) {
      setErrorMessage(t("errors.addressInvalid", { network }));
      return;
    }

    setShowOtpModal(true);
  }

  async function handleOtpConfirm(otpCode: string) {
    setIsSubmitting(true);
    try {
      await createWithdrawal({
        amount: amount.trim(),
        network,
        payment_address: paymentAddress.trim(),
        note: note.trim() || undefined,
        otp_code: otpCode,
      });

      setShowOtpModal(false);
      setSuccessMessage(t("successBanner"));
      pushToast(t("successBanner"), "success");
      setAmount("");
      setNote("");
      setPaymentAddress("");

      const txRes = await listMyTransactions();
      await refreshWallet({ silent: true });
      setHistory(txRes.data.filter((tx) => tx.type === "WITHDRAWAL"));
    } catch (error) {
      setErrorMessage(getApiErrorMessage(error, t("errors.generic")));
      throw error;
    } finally {
      setIsSubmitting(false);
    }
  }

  function statusLabel(status: TransactionStatus): string {
    if (status === "PENDING" || status === "COMPLETED" || status === "FAILED" || status === "REJECTED") {
      return t(`status.${status}`);
    }
    return status;
  }

  if (!isAuthChecked) {
    return <AuthLoading />;
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

        <div className="mb-6 rounded-2xl border border-amber-400/25 bg-amber-500/10 px-4 py-3.5 text-[13px] leading-relaxed text-amber-50 backdrop-blur-sm">
          <p className="font-semibold text-amber-100">{t("warningsTitle")}</p>
          <ul className="mt-2 list-disc space-y-1 ps-5 text-amber-100/90">
            <li>{t("warnings.usdtOnly")}</li>
            <li>{t("warnings.matchNetwork")}</li>
            <li>{t("warnings.wrongNetwork")}</li>
          </ul>
        </div>

        <div className="mb-6 rounded-2xl border border-white/14 bg-white/[0.08] p-5 backdrop-blur-sm sm:p-6">
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-300 sm:text-xs">{t("availableLabel")}</p>
          {isLoadingWallet ? (
            <div className="mt-2 h-9 w-40 animate-pulse rounded-lg bg-white/10" />
          ) : (
            <p className="mt-1.5 text-3xl font-bold tracking-tight text-white">
              {formatUsdt(availableBalance)}
              <span className="ms-1.5 text-sm font-medium text-cyan-200/80">USDT</span>
            </p>
          )}
          <p className="mt-1.5 text-[13px] text-slate-400">{t("availableHint")}</p>
          {wallet && Number(wallet.lockedBalance) > 0 ? (
            <p className="mt-1 text-xs text-slate-400">
              {t("lockedNote", { amount: formatUsdt(wallet.lockedBalance) })}
            </p>
          ) : null}
        </div>

        {errorMessage ? (
          <div className="mb-4 rounded-xl border border-rose-400/25 bg-rose-500/10 px-4 py-3 text-sm text-rose-200">
            {errorMessage}
          </div>
        ) : null}
        {successMessage ? (
          <div className="mb-4 rounded-xl border border-cyan-300/25 bg-cyan-400/10 px-4 py-3 text-sm text-cyan-100">
            {successMessage}
          </div>
        ) : null}

        <form onSubmit={handleSubmit} className="card-surface p-5 sm:p-6">
          <div className="space-y-5">
            <div>
              <span className="mb-2 block text-sm font-medium text-slate-300">{t("networkLabel")}</span>
              <div className="flex flex-wrap gap-2">
                {WITHDRAW_NETWORKS.map((net) => (
                  <button
                    key={net}
                    type="button"
                    onClick={() => setNetwork(net)}
                    className={`rounded-xl border px-4 py-2 text-sm font-semibold transition ${
                      network === net
                        ? "border-cyan-300/40 bg-cyan-400/12 text-cyan-100"
                        : "border-white/14 bg-white/[0.06] text-slate-300 hover:border-cyan-300/30 hover:bg-white/[0.1]"
                    }`}
                  >
                    USDT · {net}
                  </button>
                ))}
              </div>
              <p className="mt-2 text-xs text-slate-400">{t("networkHint", { network })}</p>
            </div>

            <div>
              <label htmlFor="withdraw-amount" className="block text-sm font-medium text-slate-300">
                {t("amountLabel")}
              </label>
              <div className="relative mt-1.5">
                <input
                  id="withdraw-amount"
                  type="number"
                  inputMode="decimal"
                  min="0"
                  step="any"
                  max={availableNum > 0 ? availableNum : undefined}
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  placeholder={t("amountPlaceholder")}
                  className="input-surface py-3 pe-24"
                />
                <button
                  type="button"
                  onClick={() => setAmount(availableBalance)}
                  disabled={availableNum <= 0}
                  className="absolute end-2 top-1/2 -translate-y-1/2 rounded-lg border border-white/14 bg-white/[0.06] px-2.5 py-1 text-xs font-semibold text-slate-300 transition hover:bg-white/[0.1] disabled:opacity-40"
                >
                  {t("maxButton")}
                </button>
              </div>
              <p className="mt-1.5 text-xs text-slate-400">
                {t("maxHint", { available: formatUsdt(availableBalance) })}
              </p>
            </div>

            <div>
              <label htmlFor="withdraw-address" className="block text-sm font-medium text-slate-300">
                {t("addressLabel")}
              </label>
              <input
                id="withdraw-address"
                type="text"
                value={paymentAddress}
                onChange={(e) => setPaymentAddress(e.target.value)}
                placeholder={t("addressPlaceholder", { network })}
                className="input-surface mt-1.5 py-3 font-mono text-sm"
                dir="ltr"
                autoComplete="off"
                spellCheck={false}
              />
            </div>

            <div>
              <label htmlFor="withdraw-note" className="block text-sm font-medium text-slate-300">
                {t("noteLabel")}{" "}
                <span className="font-normal text-slate-400">({t("noteOptional")})</span>
              </label>
              <input
                id="withdraw-note"
                type="text"
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder={t("notePlaceholder")}
                className="input-surface mt-1.5 py-3"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={availableNum <= 0}
            className="mt-6 w-full rounded-xl bg-gradient-to-r from-cyan-300 to-cyan-200 py-3 text-sm font-bold text-[#041016] shadow-[0_8px_24px_rgba(34,211,238,0.2)] transition hover:brightness-105 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {t("submit")}
          </button>
        </form>

        <section className="mt-10">
          <h2 className="text-lg font-semibold text-white">{t("historyTitle")}</h2>
          {isLoadingHistory ? (
            <div className="mt-4 h-24 animate-pulse rounded-2xl border border-white/10 bg-white/[0.06]" />
          ) : history.length === 0 ? (
            <p className="mt-4 text-sm text-slate-400">{t("historyEmpty")}</p>
          ) : (
            <div className="table-surface mt-4">
              <table className="w-full min-w-[560px] text-left text-sm">
                <thead className="border-b border-white/10 bg-white/[0.06] text-xs uppercase tracking-wider text-slate-400">
                  <tr>
                    <th className="px-4 py-3 font-medium">{t("table.amount")}</th>
                    <th className="px-4 py-3 font-medium">{t("table.network")}</th>
                    <th className="px-4 py-3 font-medium">{t("table.status")}</th>
                    <th className="px-4 py-3 font-medium">{t("table.address")}</th>
                    <th className="px-4 py-3 font-medium">{t("table.date")}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/10">
                  {history.map((tx) => (
                    <tr key={tx.id} className="text-slate-300 hover:bg-white/[0.06]">
                      <td className="px-4 py-3 font-medium text-white">{formatUsdt(tx.amount)} USDT</td>
                      <td className="px-4 py-3 font-mono text-xs text-cyan-200/90">{tx.network ?? "—"}</td>
                      <td className="px-4 py-3">
                        <StatusBadge
                          status={
                            tx.status === "FAILED"
                              ? "REJECTED"
                              : (tx.status as "PENDING" | "COMPLETED" | "FAILED" | "REJECTED")
                          }
                          label={statusLabel(tx.status)}
                        />
                      </td>
                      <td className="max-w-[160px] truncate px-4 py-3 font-mono text-xs text-slate-400" dir="ltr">
                        {tx.payment_address ?? "—"}
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 text-xs text-slate-400">
                        {formatDateTime(tx.created_at)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </main>

      {showOtpModal ? (
        <WithdrawalOtpModal
          emailHint={userEmail}
          isSubmitting={isSubmitting}
          onClose={() => setShowOtpModal(false)}
          onConfirm={handleOtpConfirm}
        />
      ) : null}
    </div>
  );
}
