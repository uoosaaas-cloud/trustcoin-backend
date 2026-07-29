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
    NONE: "border-white/14 bg-white/[0.06] text-slate-400",
    PENDING_PACKAGE_ACTIVE: "border-amber-400/30 bg-amber-500/10 text-amber-200",
    PACKAGE_COMPLETED_AWAITING_ADMIN: "border-cyan-400/30 bg-cyan-400/10 text-cyan-200",
    APPROVED_RELEASED: "border-emerald-400/30 bg-emerald-500/10 text-emerald-200",
    REJECTED: "border-rose-400/30 bg-rose-500/10 text-rose-300",
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
          valueClass: "text-white",
        },
        {
          key: "pending",
          label: t("pendingEarnings"),
          value: `${formatUsdt(stats.pending_referral_earnings)} USDT`,
          hint: t("pendingEarningsHint"),
          valueClass: "text-amber-200",
        },
        {
          key: "released",
          label: t("releasedEarnings"),
          value: `${formatUsdt(stats.total_commission_earned)} USDT`,
          hint: t("releasedEarningsHint"),
          valueClass: "text-cyan-100",
        },
      ]
    : [];

  return (
    <div className="page-shell flex flex-col">
      <AppNav />

      <main className="relative z-10 mx-auto w-full max-w-5xl flex-1 px-4 pb-16 pt-6 sm:px-6">
        <div className="mb-8">
          <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-cyan-200/90 sm:text-xs">{t("eyebrow")}</p>
          <h1 className="mt-2.5 text-2xl font-bold tracking-tight text-white sm:text-[2rem] sm:leading-tight">{t("title")}</h1>
          <p className="mt-2.5 max-w-2xl text-[15px] leading-relaxed text-slate-300">{t("subtitle")}</p>
        </div>

        {errorMessage ? (
          <div className="mb-6 rounded-xl border border-rose-400/25 bg-rose-500/10 px-4 py-3 text-sm text-rose-200">
            {errorMessage}
          </div>
        ) : null}

        <section className="card-surface mb-6 p-5">
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-300 sm:text-xs">{t("linkLabel")}</p>
          {isLoading || !stats ? (
            <div className="mt-3 h-12 animate-pulse rounded-xl bg-white/10" />
          ) : (
            <>
              <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-center">
                <code className="flex-1 truncate rounded-xl border border-white/14 bg-white/[0.06] px-4 py-3 font-mono text-sm text-cyan-200">
                  {stats.referral_link}
                </code>
                <CopyButton
                  value={stats.referral_link}
                  label={t("copyLink")}
                  copiedLabel={t("copied")}
                  className="shrink-0 justify-center py-3 sm:px-4"
                />
              </div>
              <p className="mt-3 text-xs text-slate-400">
                {t("codeLabel")}:{" "}
                <span className="font-mono font-semibold text-slate-300">{stats.referral_code}</span>
              </p>
            </>
          )}
        </section>

        {isLoading ? (
          <div className="mb-8 grid gap-4 sm:grid-cols-3">
            {[0, 1, 2].map((i) => (
              <div key={i} className="h-32 animate-pulse rounded-2xl border border-white/10 bg-white/[0.06]" />
            ))}
          </div>
        ) : (
          <div className="mb-8 grid gap-4 sm:grid-cols-3">
            {cards.map((card) => (
              <div
                key={card.key}
                className="rounded-2xl border border-white/14 bg-white/[0.08] p-5 backdrop-blur-sm transition duration-200 hover:border-cyan-300/35 hover:bg-white/[0.11]"
              >
                <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-300">{card.label}</p>
                <p className={`mt-3 text-2xl font-bold tracking-tight sm:text-3xl ${card.valueClass}`}>
                  {card.value}
                </p>
                <p className="mt-3 text-xs leading-relaxed text-slate-400">{card.hint}</p>
              </div>
            ))}
          </div>
        )}

        <section>
          <h2 className="text-lg font-semibold text-white">{t("tableTitle")}</h2>
          {isLoading ? (
            <div className="mt-4 h-28 animate-pulse rounded-2xl border border-white/10 bg-white/[0.06]" />
          ) : !stats || stats.referrals.length === 0 ? (
            <p className="mt-4 text-sm text-slate-400">{t("empty")}</p>
          ) : (
            <div className="table-surface mt-4 overflow-x-auto">
              <table className="w-full min-w-[720px] text-left text-sm">
                <thead className="border-b border-white/10 bg-white/[0.06] text-xs uppercase tracking-wider text-slate-400">
                  <tr>
                    <th className="px-4 py-3 font-medium">{t("table.user")}</th>
                    <th className="px-4 py-3 font-medium">{t("table.registered")}</th>
                    <th className="px-4 py-3 font-medium">{t("table.package")}</th>
                    <th className="px-4 py-3 font-medium">{t("table.bonus")}</th>
                    <th className="px-4 py-3 font-medium">{t("table.status")}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/10">
                  {stats.referrals.map((referral) => (
                    <tr key={referral.id} className="text-slate-300 hover:bg-white/[0.06]">
                      <td className="px-4 py-3">
                        <p className="font-medium text-white">
                          {referral.masked_email ?? referral.email}
                        </p>
                        <p className="text-[11px] text-slate-400">
                          {referral.account_status === "ACTIVE"
                            ? t("accountActive")
                            : t("accountPending")}
                        </p>
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 text-xs text-slate-400">
                        {formatDate(referral.registered_at)}
                      </td>
                      <td className="px-4 py-3">
                        {referral.package_name ? (
                          <>
                            <p className="font-medium text-slate-100">{referral.package_name}</p>
                            <p className="text-xs text-slate-400">
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
                      <td className="px-4 py-3 font-semibold text-cyan-200">
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
