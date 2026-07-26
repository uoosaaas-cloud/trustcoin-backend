"use client";

import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useCallback, useEffect, useState } from "react";
import { AppNav } from "@/components/AppNav";
import { CopyButton } from "@/components/CopyButton";
import { useWallet } from "@/contexts/WalletContext";
import { useSilentPoll } from "@/hooks/useSilentPoll";
import { getApiErrorMessage, getStoredAuthToken } from "@/lib/api";
import { formatUsdt, formatDate } from "@/lib/format";
import {
  getReferralStats,
  type ReferralBonusState,
  type ReferralStats,
} from "@/lib/referrals";

function BonusStatusPill({ status, label }: { status: ReferralBonusState; label: string }) {
  const styles: Record<ReferralBonusState, string> = {
    NONE: "border-slate-200 bg-slate-50 text-slate-600",
    PENDING_PACKAGE_ACTIVE: "border-amber-200 bg-amber-50 text-amber-800",
    PACKAGE_COMPLETED_AWAITING_ADMIN: "border-blue-200 bg-blue-50 text-blue-800",
    APPROVED_RELEASED: "border-green-200 bg-green-50 text-green-800",
    REJECTED: "border-rose-200 bg-rose-50 text-rose-700",
  };

  return (
    <span
      className={`inline-flex items-center rounded-md border px-2.5 py-1 text-xs font-semibold ${styles[status]}`}
    >
      {label}
    </span>
  );
}

export default function ReferralsPage() {
  const router = useRouter();
  const t = useTranslations("referrals");
  const tCommon = useTranslations("common");
  const { refreshWallet } = useWallet();

  const [isAuthChecked, setIsAuthChecked] = useState(false);
  const [stats, setStats] = useState<ReferralStats | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!getStoredAuthToken()) {
      router.replace("/login?next=/referrals");
      return;
    }
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setIsAuthChecked(true);
  }, [router]);

  useEffect(() => {
    if (!isAuthChecked) return;

    let isMounted = true;

    async function load() {
      try {
        const [response] = await Promise.all([
          getReferralStats(),
          refreshWallet({ silent: true }),
        ]);
        if (!isMounted) return;
        setStats(response.data);
      } catch (error) {
        if (!isMounted) return;
        setErrorMessage(getApiErrorMessage(error, tCommon("unknownError")));
      } finally {
        if (isMounted) setIsLoading(false);
      }
    }

    load();
    return () => {
      isMounted = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAuthChecked]);

  const silentRefreshReferrals = useCallback(async () => {
    try {
      const [response] = await Promise.all([
        getReferralStats(),
        refreshWallet({ silent: true }),
      ]);
      setStats(response.data);
    } catch {
      // Keep last known referral stats on silent failure.
    }
  }, [refreshWallet]);

  useSilentPoll(silentRefreshReferrals, { enabled: isAuthChecked });

  if (!isAuthChecked) {
    return null;
  }

  const cards = stats
    ? [
        {
          key: "total",
          label: t("totalReferrals"),
          value: String(stats.total_referrals),
          hint: t("totalReferralsHint"),
          accent: "from-brand-50 to-white border-brand-200",
          valueClass: "text-slate-900",
        },
        {
          key: "pending",
          label: t("pendingEarnings"),
          value: `${formatUsdt(stats.pending_referral_earnings)} USDT`,
          hint: t("pendingEarningsHint"),
          accent: "from-amber-50 to-white border-amber-200",
          valueClass: "text-amber-700",
        },
        {
          key: "released",
          label: t("releasedEarnings"),
          value: `${formatUsdt(stats.total_commission_earned)} USDT`,
          hint: t("releasedEarningsHint"),
          accent: "from-green-50 to-white border-green-200",
          valueClass: "text-green-600",
        },
      ]
    : [];

  return (
    <div className="page-shell flex flex-col">
      <AppNav />

      <main className="relative z-10 mx-auto w-full max-w-5xl flex-1 px-4 pb-16 pt-6 sm:px-6">
        <div className="mb-8">
          <p className="text-xs font-semibold uppercase tracking-widest text-brand-500">{t("eyebrow")}</p>
          <h1 className="mt-2 text-2xl font-bold text-slate-900 sm:text-3xl">{t("title")}</h1>
          <p className="mt-2 max-w-2xl text-sm leading-relaxed text-slate-600">{t("subtitle")}</p>
        </div>

        {errorMessage ? (
          <div className="mb-6 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
            {errorMessage}
          </div>
        ) : null}

        <section className="card-surface mb-6 rounded-3xl p-5">
          <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">{t("linkLabel")}</p>
          {isLoading || !stats ? (
            <div className="mt-3 h-12 animate-pulse rounded-xl bg-slate-100" />
          ) : (
            <>
              <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-center">
                <code className="flex-1 truncate rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 font-mono text-sm text-brand-600">
                  {stats.referral_link}
                </code>
                <CopyButton
                  value={stats.referral_link}
                  label={t("copyLink")}
                  copiedLabel={t("copied")}
                  className="shrink-0 justify-center py-3 sm:px-4"
                />
              </div>
              <p className="mt-3 text-xs text-slate-500">
                {t("codeLabel")}:{" "}
                <span className="font-mono font-semibold text-slate-700">{stats.referral_code}</span>
              </p>
            </>
          )}
        </section>

        {isLoading ? (
          <div className="mb-8 grid gap-4 sm:grid-cols-3">
            {[0, 1, 2].map((i) => (
              <div key={i} className="h-32 animate-pulse rounded-3xl border border-slate-200 bg-white" />
            ))}
          </div>
        ) : (
          <div className="mb-8 grid gap-4 sm:grid-cols-3">
            {cards.map((card) => (
              <div
                key={card.key}
                className={`rounded-3xl border bg-gradient-to-br p-5 shadow-sm ${card.accent}`}
              >
                <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">{card.label}</p>
                <p className={`mt-3 text-2xl font-bold tracking-tight sm:text-3xl ${card.valueClass}`}>
                  {card.value}
                </p>
                <p className="mt-3 text-xs leading-relaxed text-slate-500">{card.hint}</p>
              </div>
            ))}
          </div>
        )}

        <section>
          <h2 className="text-lg font-semibold text-slate-900">{t("tableTitle")}</h2>
          {isLoading ? (
            <div className="mt-4 h-28 animate-pulse rounded-2xl border border-slate-200 bg-white" />
          ) : !stats || stats.referrals.length === 0 ? (
            <p className="mt-4 text-sm text-slate-500">{t("empty")}</p>
          ) : (
            <div className="table-surface mt-4 overflow-x-auto">
              <table className="w-full min-w-[720px] text-left text-sm">
                <thead className="border-b border-slate-200 bg-slate-50 text-xs uppercase tracking-wider text-slate-500">
                  <tr>
                    <th className="px-4 py-3 font-medium">{t("table.user")}</th>
                    <th className="px-4 py-3 font-medium">{t("table.registered")}</th>
                    <th className="px-4 py-3 font-medium">{t("table.package")}</th>
                    <th className="px-4 py-3 font-medium">{t("table.bonus")}</th>
                    <th className="px-4 py-3 font-medium">{t("table.status")}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {stats.referrals.map((referral) => (
                    <tr key={referral.id} className="text-slate-700 hover:bg-slate-50/80">
                      <td className="px-4 py-3">
                        <p className="font-medium text-slate-900">
                          {referral.masked_email ?? referral.email}
                        </p>
                        <p className="text-[11px] text-slate-500">
                          {referral.account_status === "ACTIVE"
                            ? t("accountActive")
                            : t("accountPending")}
                        </p>
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 text-xs text-slate-500">
                        {formatDate(referral.registered_at)}
                      </td>
                      <td className="px-4 py-3">
                        {referral.package_name ? (
                          <>
                            <p className="font-medium text-slate-800">{referral.package_name}</p>
                            <p className="text-xs text-slate-500">
                              {formatUsdt(referral.package_amount ?? "0")} USDT
                              {referral.expected_profit ? (
                                <>
                                  {" "}
                                  · {t("profit")}: {formatUsdt(referral.expected_profit)}
                                </>
                              ) : null}
                            </p>
                          </>
                        ) : (
                          <span className="text-xs text-slate-400">{t("noPackage")}</span>
                        )}
                      </td>
                      <td className="px-4 py-3 font-semibold text-green-600">
                        {referral.referral_bonus
                          ? `${formatUsdt(referral.referral_bonus)} USDT`
                          : "—"}
                      </td>
                      <td className="px-4 py-3">
                        <BonusStatusPill
                          status={referral.bonus_status}
                          label={t(`bonusStatus.${referral.bonus_status}`)}
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </main>
    </div>
  );
}
