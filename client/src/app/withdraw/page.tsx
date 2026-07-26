"use client";

import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useCallback, useEffect, useMemo, useState } from "react";
import { AppNav } from "@/components/AppNav";
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

    if (trimmedAddress.length < 6) {
      setErrorMessage(t("errors.addressRequired"));
      return;
    }

    setShowOtpModal(true);
  }

  async function handleOtpConfirm(otpCode: string) {
    setIsSubmitting(true);
    try {
      await createWithdrawal({
        amount: amount.trim(),
        payment_address: paymentAddress.trim(),
        note: note.trim() || undefined,
        otp_code: otpCode,
      });

      setShowOtpModal(false);
      setSuccessMessage(t("successBanner"));
      pushToast(t("successBanner"), "success");
      setAmount("");
      setNote("");

      const txRes = await listMyTransactions();
      await refreshWallet({ silent: true });
      setHistory(txRes.data.filter((tx) => tx.type === "WITHDRAWAL"));
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
    return null;
  }

  return (
    <div className="page-shell flex flex-col">
      <AppNav />

      <main className="relative z-10 mx-auto w-full max-w-3xl flex-1 px-4 pb-16 pt-6 sm:px-6">
        <div className="mb-6">
          <p className="text-xs font-semibold uppercase tracking-widest text-brand-500">{t("eyebrow")}</p>
          <h1 className="mt-2 text-2xl font-bold text-slate-900 sm:text-3xl">{t("title")}</h1>
          <p className="mt-2 text-sm leading-relaxed text-slate-600">{t("subtitle")}</p>
        </div>

        <div className="mb-6 rounded-3xl border border-green-200 bg-gradient-to-br from-green-50 to-white p-5 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-wider text-green-700">{t("availableLabel")}</p>
          {isLoadingWallet ? (
            <div className="mt-3 h-9 w-40 animate-pulse rounded-lg bg-slate-100" />
          ) : (
            <p className="mt-2 text-3xl font-bold tracking-tight text-green-600">
              {formatUsdt(availableBalance)}
              <span className="ms-1.5 text-sm font-medium text-slate-500">USDT</span>
            </p>
          )}
          <p className="mt-2 text-xs text-slate-500">{t("availableHint")}</p>
          {wallet && Number(wallet.lockedBalance) > 0 ? (
            <p className="mt-1 text-xs text-slate-500">
              {t("lockedNote", { amount: formatUsdt(wallet.lockedBalance) })}
            </p>
          ) : null}
        </div>

        {errorMessage ? (
          <div className="mb-4 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
            {errorMessage}
          </div>
        ) : null}
        {successMessage ? (
          <div className="mb-4 rounded-2xl border border-brand-200 bg-brand-50 px-4 py-3 text-sm text-brand-700">
            {successMessage}
          </div>
        ) : null}

        <form onSubmit={handleSubmit} className="card-surface rounded-3xl p-5 sm:p-6">
          <div className="space-y-5">
            <div>
              <label htmlFor="withdraw-amount" className="block text-sm font-medium text-slate-700">
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
                  className="absolute end-2 top-1/2 -translate-y-1/2 rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs font-semibold text-slate-700 transition hover:bg-slate-100 disabled:opacity-40"
                >
                  {t("maxButton")}
                </button>
              </div>
              <p className="mt-1.5 text-xs text-slate-500">
                {t("maxHint", { available: formatUsdt(availableBalance) })}
              </p>
            </div>

            <div>
              <label htmlFor="withdraw-address" className="block text-sm font-medium text-slate-700">
                {t("addressLabel")}
              </label>
              <input
                id="withdraw-address"
                type="text"
                value={paymentAddress}
                onChange={(e) => setPaymentAddress(e.target.value)}
                placeholder={t("addressPlaceholder")}
                className="input-surface mt-1.5 py-3 font-mono text-sm"
              />
            </div>

            <div>
              <label htmlFor="withdraw-note" className="block text-sm font-medium text-slate-700">
                {t("noteLabel")}{" "}
                <span className="font-normal text-slate-500">({t("noteOptional")})</span>
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
            className="mt-6 w-full rounded-xl bg-gradient-to-r from-brand-500 to-brand-600 py-3 text-sm font-semibold text-white shadow-lg shadow-brand-500/25 transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {t("submit")}
          </button>
        </form>

        <section className="mt-10">
          <h2 className="text-lg font-semibold text-slate-900">{t("historyTitle")}</h2>
          {isLoadingHistory ? (
            <div className="mt-4 h-24 animate-pulse rounded-2xl border border-slate-200 bg-white" />
          ) : history.length === 0 ? (
            <p className="mt-4 text-sm text-slate-500">{t("historyEmpty")}</p>
          ) : (
            <div className="table-surface mt-4">
              <table className="w-full min-w-[480px] text-left text-sm">
                <thead className="border-b border-slate-200 bg-slate-50 text-xs uppercase tracking-wider text-slate-500">
                  <tr>
                    <th className="px-4 py-3 font-medium">{t("table.amount")}</th>
                    <th className="px-4 py-3 font-medium">{t("table.status")}</th>
                    <th className="px-4 py-3 font-medium">{t("table.address")}</th>
                    <th className="px-4 py-3 font-medium">{t("table.date")}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {history.map((tx) => (
                    <tr key={tx.id} className="text-slate-700 hover:bg-slate-50/80">
                      <td className="px-4 py-3 font-medium text-slate-900">{formatUsdt(tx.amount)} USDT</td>
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
                      <td className="max-w-[160px] truncate px-4 py-3 font-mono text-xs text-slate-500">
                        {tx.payment_address ?? "—"}
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 text-xs text-slate-500">
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
