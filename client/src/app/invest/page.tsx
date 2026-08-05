"use client";

import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { AppNav } from "@/components/AppNav";
import { AuthLoading } from "@/components/AuthLoading";
import { InvestModal } from "@/components/InvestModal";
import { MyInvestments } from "@/components/MyInvestments";
import { TrustComplianceBlock } from "@/components/TrustCompliance";
import { useWallet } from "@/contexts/WalletContext";
import { useSilentPoll } from "@/hooks/useSilentPoll";
import { getApiErrorMessage, getStoredAuthToken } from "@/lib/api";
import { formatUsdt } from "@/lib/format";
import {
  durationKeyFromPackage,
  getInvestmentPackages,
  getPeriodReturnPercent,
  groupPackagesByTier,
  type InvestmentPackage,
} from "@/lib/investments";

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
  const [myPackagesRefresh, setMyPackagesRefresh] = useState(0);

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
    setMyPackagesRefresh((n) => n + 1);
    setSuccessMessage(t("successBanner"));
  }

  if (!isAuthChecked) {
    return <AuthLoading />;
  }

  const tiers = groupPackagesByTier(packages);
  const availableBalance = wallet?.availableBalance ?? "0";

  return (
    <div className="page-shell flex flex-col">
      <AppNav />

      <main className="relative z-10 mx-auto w-full max-w-5xl flex-1 px-4 pb-16 pt-7 sm:px-6">
        <div className="mb-6">
          <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-cyan-200/90 sm:text-xs">
            {t("eyebrow")}
          </p>
          <h1 className="mt-2.5 text-2xl font-bold tracking-tight text-white sm:text-[2rem] sm:leading-tight">
            {t("title")}
          </h1>
          <p className="mt-2.5 max-w-2xl text-[15px] leading-relaxed text-slate-300">{t("subtitle")}</p>
        </div>

        <div className="mb-6 rounded-2xl border border-white/14 bg-white/[0.08] p-5 backdrop-blur-sm sm:p-6">
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-300 sm:text-xs">
            {t("availableLabel")}
          </p>
          {isWalletLoading ? (
            <div className="mt-2 h-9 w-36 animate-pulse rounded-lg bg-white/10" />
          ) : (
            <p className="mt-1.5 text-3xl font-bold tracking-tight text-white">
              {formatUsdt(availableBalance)}
              <span className="ms-1.5 text-sm font-medium text-cyan-200/80">USDT</span>
            </p>
          )}
          <p className="mt-1.5 text-[13px] text-slate-400">{t("availableHint")}</p>
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

        <MyInvestments refreshToken={myPackagesRefresh} />

        {isLoadingPackages ? (
          <div className="space-y-4">
            {[0, 1, 2].map((i) => (
              <div key={i} className="h-48 animate-pulse rounded-2xl border border-white/10 bg-white/[0.06]" />
            ))}
          </div>
        ) : (
          <div className="space-y-4">
            {tiers.map((tier) => (
              <section
                key={tier.amount}
                className="rounded-2xl border border-white/12 bg-white/[0.05] p-5 backdrop-blur-sm sm:p-6"
              >
                <div className="mb-5 border-b border-white/10 pb-4">
                  <h2 className="text-lg font-semibold tracking-tight text-white sm:text-xl">
                    {t("tierTitle", { amount: formatUsdt(tier.amount) })}
                  </h2>
                  <p className="mt-1.5 text-[13px] text-slate-400">
                    {t("tierFixedAmount", { amount: formatUsdt(tier.amount) })}
                  </p>
                </div>

                <div className="grid gap-3.5 sm:grid-cols-2 lg:grid-cols-4">
                  {tier.variants.map((pkg) => {
                    const periodReturn = getPeriodReturnPercent(pkg);
                    return (
                      <div
                        key={pkg.id}
                        className="flex flex-col rounded-2xl border border-white/14 bg-white/[0.08] p-5 backdrop-blur-sm transition duration-200 hover:border-cyan-300/35 hover:bg-white/[0.11]"
                      >
                        <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-300">
                          {t(`duration.${durationKeyFromPackage(pkg)}`)}
                        </p>
                        <p className="mt-2.5 text-3xl font-bold tracking-tight text-cyan-100">{periodReturn}%</p>
                        <p className="mt-1 text-[13px] text-slate-400">
                          {t(`periodReturn.${durationKeyFromPackage(pkg)}`)}
                        </p>

                        <dl className="mt-5 space-y-2.5 border-t border-white/10 pt-4 text-[13px]">
                          <div className="flex justify-between gap-2">
                            <dt className="text-slate-400">{t("fixedAmountLabel")}</dt>
                            <dd className="font-semibold text-slate-100">{formatUsdt(pkg.amount)} USDT</dd>
                          </div>
                          <div className="flex justify-between gap-2">
                            <dt className="text-slate-400">{t("durationLabel")}</dt>
                            <dd className="font-semibold text-slate-100">
                              {pkg.duration_days} {t("days")}
                            </dd>
                          </div>
                        </dl>

                        {Number(availableBalance) < Number(pkg.amount) ? (
                          <div className="mt-5 space-y-2">
                            <p className="text-center text-[12px] text-amber-200/90">
                              {t("needMore", {
                                amount: formatUsdt(Number(pkg.amount) - Number(availableBalance)),
                              })}
                            </p>
                            <Link
                              href="/deposit"
                              className="inline-flex w-full items-center justify-center rounded-xl border border-cyan-300/30 bg-cyan-400/10 py-3 text-sm font-bold text-cyan-100 transition hover:bg-cyan-400/15"
                            >
                              {t("depositToInvest")}
                            </Link>
                          </div>
                        ) : (
                          <button
                            type="button"
                            onClick={() => openInvestModal(pkg)}
                            className="mt-5 w-full rounded-xl bg-gradient-to-r from-cyan-300 to-cyan-200 py-3 text-sm font-bold text-[#041016] shadow-[0_8px_24px_rgba(34,211,238,0.2)] transition hover:brightness-105"
                          >
                            {t("investNow")}
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>
              </section>
            ))}
          </div>
        )}

        <div className="mt-8">
          <TrustComplianceBlock compact />
        </div>
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
