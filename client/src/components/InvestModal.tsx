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
        className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm"
        onClick={onClose}
      />

      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="invest-modal-title"
        className="card-surface relative z-10 w-full max-w-md rounded-3xl p-5 sm:p-6"
      >
        <div className="mb-5">
          <p className="text-xs font-semibold uppercase tracking-widest text-brand-500">{t("modal.eyebrow")}</p>
          <h2 id="invest-modal-title" className="mt-1 text-xl font-bold text-slate-900">
            {pkg.name}
          </h2>
          <p className="mt-1 text-sm text-slate-600">{t(`modal.${durationKey(pkg.duration_days)}`)}</p>
        </div>

        <dl className="mb-5 grid grid-cols-2 gap-3 rounded-2xl border border-slate-200 bg-slate-50 p-3 text-sm">
          <div>
            <dt className="text-xs text-slate-500">{t(`periodReturn.${durationKey(pkg.duration_days)}`)}</dt>
            <dd className="mt-0.5 font-semibold text-blue-600">{periodReturn}%</dd>
          </div>
          <div>
            <dt className="text-xs text-slate-500">{t("modal.duration")}</dt>
            <dd className="mt-0.5 font-semibold text-slate-900">
              {pkg.duration_days} {t("modal.days")}
            </dd>
          </div>
          <div>
            <dt className="text-xs text-slate-500">{t("modal.fixedAmount")}</dt>
            <dd className="mt-0.5 font-semibold text-slate-900">{formatUsdt(pkg.amount)} USDT</dd>
          </div>
          <div>
            <dt className="text-xs text-slate-500">{t("modal.available")}</dt>
            <dd className="mt-0.5 font-semibold text-green-600">{formatUsdt(availableBalance)} USDT</dd>
          </div>
        </dl>

        {errorMessage ? (
          <div className="mb-4 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
            {errorMessage}
          </div>
        ) : null}

        <form onSubmit={handleSubmit}>
          <p className="rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-600">
            {t("modal.fixedAmountHint", { amount: formatUsdt(pkg.amount) })}
          </p>

          <div className="mt-6 flex gap-3">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 rounded-xl border border-slate-200 bg-white py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
            >
              {t("modal.cancel")}
            </button>
            <button
              type="submit"
              disabled={isSubmitting || availableNum < packageAmount}
              className="flex-1 rounded-xl bg-gradient-to-r from-brand-500 to-brand-600 py-3 text-sm font-semibold text-white shadow-lg shadow-brand-500/25 transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {isSubmitting ? t("modal.submitting") : t("modal.submit")}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
