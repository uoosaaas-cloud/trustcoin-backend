"use client";

import { useTranslations } from "next-intl";
import { useEffect, useState } from "react";
import { getApiErrorMessage } from "@/lib/api";
import { formatUsdt } from "@/lib/format";
import {
  getPeriodReturnPercent,
  purchaseInvestment,
  type InvestmentPackage,
} from "@/lib/investments";

interface InvestModalProps {
  pkg: InvestmentPackage;
  availableBalance: string;
  onClose: () => void;
  onSuccess: () => void;
}

function durationKey(days: number): "duration1m" | "duration3m" | "duration6m" {
  if (days <= 30) return "duration1m";
  if (days <= 90) return "duration3m";
  return "duration6m";
}

export function InvestModal({ pkg, availableBalance, onClose, onSuccess }: InvestModalProps) {
  const t = useTranslations("invest");
  const tCommon = useTranslations("common");

  const packageAmount = Number(pkg.amount);
  const availableNum = Number(availableBalance);
  const periodReturn = getPeriodReturnPercent(pkg);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setErrorMessage(null);

    if (availableNum < packageAmount) {
      setErrorMessage(t("errors.exceedsAvailable", { available: formatUsdt(availableBalance) }));
      return;
    }

    setIsSubmitting(true);

    try {
      await purchaseInvestment({ packageId: pkg.id, amount: pkg.amount });
      onSuccess();
      onClose();
    } catch (error) {
      setErrorMessage(getApiErrorMessage(error, t("errors.generic")));
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center p-4 sm:items-center">
      <button
        type="button"
        aria-label={tCommon("back")}
        className="absolute inset-0 bg-[#071018]/70 backdrop-blur-sm"
        onClick={onClose}
      />

      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="invest-modal-title"
        className="relative z-10 w-full max-w-md rounded-2xl border border-white/14 bg-[#0c1524]/95 p-5 shadow-[0_20px_60px_rgba(0,0,0,0.45)] backdrop-blur-md sm:p-6"
      >
        <div className="mb-5">
          <p className="text-xs font-semibold uppercase tracking-widest text-cyan-200/90">{t("modal.eyebrow")}</p>
          <h2 id="invest-modal-title" className="mt-1 text-xl font-bold text-white">
            {pkg.name}
          </h2>
          <p className="mt-1 text-sm text-slate-400">{t(`modal.${durationKey(pkg.duration_days)}`)}</p>
        </div>

        <dl className="mb-5 grid grid-cols-2 gap-3 rounded-xl border border-white/12 bg-white/[0.06] p-3.5 text-sm">
          <div>
            <dt className="text-xs text-slate-400">{t(`periodReturn.${durationKey(pkg.duration_days)}`)}</dt>
            <dd className="mt-0.5 font-semibold text-cyan-100">{periodReturn}%</dd>
          </div>
          <div>
            <dt className="text-xs text-slate-400">{t("modal.duration")}</dt>
            <dd className="mt-0.5 font-semibold text-slate-100">
              {pkg.duration_days} {t("modal.days")}
            </dd>
          </div>
          <div>
            <dt className="text-xs text-slate-400">{t("modal.fixedAmount")}</dt>
            <dd className="mt-0.5 font-semibold text-slate-100">{formatUsdt(pkg.amount)} USDT</dd>
          </div>
          <div>
            <dt className="text-xs text-slate-400">{t("modal.available")}</dt>
            <dd className="mt-0.5 font-semibold text-cyan-100">{formatUsdt(availableBalance)} USDT</dd>
          </div>
        </dl>

        {errorMessage ? (
          <div className="mb-4 rounded-xl border border-rose-400/25 bg-rose-500/10 px-4 py-3 text-sm text-rose-200">
            {errorMessage}
          </div>
        ) : null}

        <form onSubmit={handleSubmit}>
          <p className="rounded-xl border border-white/12 bg-white/[0.06] px-4 py-3 text-sm text-slate-300">
            {t("modal.fixedAmountHint", { amount: formatUsdt(pkg.amount) })}
          </p>

          <div className="mt-6 flex gap-3">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 rounded-xl border border-white/14 bg-white/[0.06] py-3 text-sm font-semibold text-slate-200 transition hover:bg-white/[0.1]"
            >
              {t("modal.cancel")}
            </button>
            <button
              type="submit"
              disabled={isSubmitting || availableNum < packageAmount}
              className="flex-1 rounded-xl bg-gradient-to-r from-cyan-300 to-cyan-200 py-3 text-sm font-bold text-[#041016] shadow-[0_8px_24px_rgba(34,211,238,0.2)] transition hover:brightness-105 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {isSubmitting ? t("modal.submitting") : t("modal.submit")}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
