"use client";

import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useCallback, useEffect, useState } from "react";
import { AppNav } from "@/components/AppNav";
import { InvestModal } from "@/components/InvestModal";
import { TrustComplianceBlock } from "@/components/TrustCompliance";
import { useWallet } from "@/contexts/WalletContext";
import { useSilentPoll } from "@/hooks/useSilentPoll";
import { getApiErrorMessage, getStoredAuthToken } from "@/lib/api";
import { formatUsdt } from "@/lib/format";
import {
  getInvestmentPackages,
  getPeriodReturnPercent,
  groupPackagesByTier,
  type InvestmentPackage,
} from "@/lib/investments";

function durationKey(days: number): "duration1m" | "duration3m" | "duration6m" {
  if (days <= 30) return "duration1m";
  if (days <= 90) return "duration3m";
  return "duration6m";
}

export default function InvestPage() {
  const router = useRouter();
  const t = useTranslations("invest");
  const tCommon = useTranslations("common");
  const { wallet, isLoading: isWalletLoading, refreshWallet } = useWallet();

  const [isAuthChecked, setIsAuthChecked] = useState(false);
  const [packages, setPackages] = useState<InvestmentPackage[]>([]);
  const [isLoadingPackages, setIsLoadingPackages] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [selectedPackage, setSelectedPackage] = useState<InvestmentPackage | null>(null);

  useEffect(() => {
    if (!getStoredAuthToken()) {
      router.replace("/login?next=/invest");
      return;
    }
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setIsAuthChecked(true);
  }, [router]);

  useEffect(() => {
    if (!isAuthChecked) return;

    let isMounted = true;

    async function loadPackages() {
      try {
        const response = await getInvestmentPackages();
        if (!isMounted) return;
        setPackages(response.data);
      } catch (error) {
        if (!isMounted) return;
        setErrorMessage(getApiErrorMessage(error, tCommon("unknownError")));
      } finally {
        if (isMounted) setIsLoadingPackages(false);
      }
    }

    void refreshWallet({ silent: true });
    loadPackages();

    return () => {
      isMounted = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAuthChecked]);

  const silentRefreshInvest = useCallback(async () => {
    try {
      const [packagesResponse] = await Promise.all([
        getInvestmentPackages(),
        refreshWallet({ silent: true }),
      ]);
      setPackages(packagesResponse.data);
    } catch {
      // Keep last known packages/wallet during silent refresh.
    }
  }, [refreshWallet]);

  useSilentPoll(silentRefreshInvest, { enabled: isAuthChecked });

  function openInvestModal(pkg: InvestmentPackage) {
    setSuccessMessage(null);
    setSelectedPackage(pkg);
  }

  async function handlePurchaseSuccess() {
    await refreshWallet({ silent: true });
    setSuccessMessage(t("successBanner"));
  }

  if (!isAuthChecked) {
    return null;
  }

  const tiers = groupPackagesByTier(packages);
  const availableBalance = wallet?.availableBalance ?? "0";

  return (
    <div className="page-shell flex flex-col">
      <AppNav />

      <main className="relative z-10 mx-auto w-full max-w-5xl flex-1 px-4 pb-16 pt-7 sm:px-6">
        <div className="mb-7">
          <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-brand-500 sm:text-xs">{t("eyebrow")}</p>
          <h1 className="mt-2.5 text-2xl font-bold tracking-tight text-slate-900 sm:text-[2rem] sm:leading-tight">
            {t("title")}
          </h1>
          <p className="mt-2.5 max-w-2xl text-[15px] leading-relaxed text-slate-600">{t("subtitle")}</p>
        </div>

        <div className="mb-7">
          <TrustComplianceBlock />
        </div>

        <div className="mb-7 rounded-[1.5rem] border border-green-200/80 bg-gradient-to-br from-green-50 via-white to-white p-5 shadow-[0_4px_24px_rgba(34,197,94,0.08)] sm:p-6">
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-green-700 sm:text-xs">
            {t("availableLabel")}
          </p>
          {isWalletLoading ? (
            <div className="mt-2 h-9 w-36 animate-pulse rounded-lg bg-slate-100" />
          ) : (
            <p className="mt-1.5 text-3xl font-bold tracking-tight text-green-600">
              {formatUsdt(availableBalance)}
              <span className="ms-1.5 text-sm font-medium text-slate-500">USDT</span>
            </p>
          )}
          <p className="mt-1.5 text-[13px] text-slate-500">{t("availableHint")}</p>
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

        {isLoadingPackages ? (
          <div className="space-y-4">
            {[0, 1, 2].map((i) => (
              <div key={i} className="h-48 animate-pulse rounded-3xl border border-slate-200 bg-white" />
            ))}
          </div>
        ) : (
          <div className="space-y-4">
            {tiers.map((tier) => (
              <section key={tier.amount} className="card-surface rounded-[1.5rem] p-5 sm:p-6">
                <div className="mb-5">
                  <h2 className="text-lg font-semibold tracking-tight text-slate-900 sm:text-xl">
                    {t("tierTitle", { amount: formatUsdt(tier.amount) })}
                  </h2>
                  <p className="mt-1.5 text-[13px] text-slate-500">
                    {t("tierFixedAmount", { amount: formatUsdt(tier.amount) })}
                  </p>
                </div>

                <div className="grid gap-3.5 sm:grid-cols-3">
                  {tier.variants.map((pkg) => {
                    const periodReturn = getPeriodReturnPercent(pkg);
                    return (
                      <div
                        key={pkg.id}
                        className="flex flex-col rounded-2xl border border-slate-200/90 bg-gradient-to-b from-white to-slate-50/80 p-5 shadow-[0_2px_12px_rgba(15,23,42,0.04)] transition duration-200 hover:-translate-y-0.5 hover:border-brand-200 hover:shadow-[0_10px_28px_rgba(15,23,42,0.08)]"
                      >
                        <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-brand-500">
                          {t(`duration.${durationKey(pkg.duration_days)}`)}
                        </p>
                        <p className="mt-2.5 text-3xl font-bold tracking-tight text-blue-600">{periodReturn}%</p>
                        <p className="mt-1 text-[13px] text-slate-500">
                          {t(`periodReturn.${durationKey(pkg.duration_days)}`)}
                        </p>

                        <dl className="mt-5 space-y-2.5 text-[13px]">
                          <div className="flex justify-between gap-2">
                            <dt className="text-slate-500">{t("fixedAmountLabel")}</dt>
                            <dd className="font-semibold text-slate-800">{formatUsdt(pkg.amount)} USDT</dd>
                          </div>
                          <div className="flex justify-between gap-2">
                            <dt className="text-slate-500">{t("durationLabel")}</dt>
                            <dd className="font-semibold text-slate-800">
                              {pkg.duration_days} {t("days")}
                            </dd>
                          </div>
                        </dl>

                        <button
                          type="button"
                          disabled={Number(availableBalance) < Number(pkg.amount)}
                          onClick={() => openInvestModal(pkg)}
                          className="mt-5 w-full rounded-xl bg-gradient-to-r from-brand-500 to-brand-600 py-3 text-sm font-semibold text-white shadow-lg shadow-brand-500/20 transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-40"
                        >
                          {t("investNow")}
                        </button>
                      </div>
                    );
                  })}
                </div>
              </section>
            ))}
          </div>
        )}
      </main>

      {selectedPackage ? (
        <InvestModal
          pkg={selectedPackage}
          availableBalance={availableBalance}
          onClose={() => setSelectedPackage(null)}
          onSuccess={handlePurchaseSuccess}
        />
      ) : null}
    </div>
  );
}
