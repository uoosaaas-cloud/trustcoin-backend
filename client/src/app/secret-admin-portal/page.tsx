"use client";

import Link from "next/link";
import { useTranslations } from "next-intl";
import { useCallback, useState } from "react";
import { AdminNav } from "@/components/AdminNav";
import { useRequireAdmin } from "@/hooks/useRequireAdmin";
import { usePollingReload } from "@/hooks/usePollingReload";
import { getAdminOverview, type AdminOverviewStats } from "@/lib/admin";
import { ADMIN_ROUTES } from "@/lib/adminPaths";
import { getApiErrorMessage } from "@/lib/api";
import { formatUsdt } from "@/lib/format";

export default function AdminOverviewPage() {
  const ready = useRequireAdmin();
  const t = useTranslations("admin.overview");
  const tCommon = useTranslations("common");

  const [stats, setStats] = useState<AdminOverviewStats | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const response = await getAdminOverview();
      setStats(response.data);
      setErrorMessage(null);
    } catch (error) {
      setErrorMessage(getApiErrorMessage(error, tCommon("unknownError")));
    } finally {
      setIsLoading(false);
    }
  }, [tCommon]);

  usePollingReload(load, ready, 10_000);

  if (!ready) return null;

  const cards = stats
    ? [
        {
          key: "users",
          label: t("totalUsers"),
          value: String(stats.totalUsers),
          hint: t("totalUsersHint"),
          accent: "from-cyan-400/10 to-[#0a1220] border-cyan-400/25",
        },
        {
          key: "deposits",
          label: t("totalDeposits"),
          value: `${formatUsdt(stats.totalDeposits)} USDT`,
          hint: t("totalDepositsHint"),
          accent: "from-emerald-400/10 to-[#0a1220] border-emerald-400/30",
        },
        {
          key: "withdrawals",
          label: t("totalWithdrawals"),
          value: `${formatUsdt(stats.totalWithdrawals)} USDT`,
          hint: t("totalWithdrawalsHint"),
          accent: "from-blue-400/10 to-[#0a1220] border-cyan-400/30",
        },
        {
          key: "investments",
          label: t("activeInvestments"),
          value: String(stats.totalActiveInvestments),
          hint: t("activeInvestmentsHint"),
          accent: "from-white/5 to-[#0a1220] border-white/10",
        },
      ]
    : [];

  return (
    <div className="page-shell">
      <AdminNav />

      <main className="relative z-10 mx-auto max-w-6xl px-4 py-8 sm:px-6">
        <div className="mb-8">
          <p className="text-xs font-semibold uppercase tracking-widest text-cyan-300">{t("eyebrow")}</p>
          <h1 className="mt-2 text-2xl font-bold text-white sm:text-3xl">{t("title")}</h1>
          <p className="mt-2 text-sm text-slate-400">{t("subtitle")}</p>
        </div>

        {errorMessage ? (
          <div className="mb-6 rounded-2xl border border-rose-400/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-300">
            {errorMessage}
          </div>
        ) : null}

        {isLoading ? (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {[0, 1, 2, 3].map((i) => (
              <div key={i} className="h-32 animate-pulse rounded-3xl border border-white/10 bg-white/5" />
            ))}
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {cards.map((card) => (
              <div
                key={card.key}
                className={`rounded-3xl border bg-gradient-to-br p-5 ${card.accent}`}
              >
                <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">{card.label}</p>
                <p className="mt-3 text-2xl font-bold text-white">{card.value}</p>
                <p className="mt-2 text-xs text-slate-400">{card.hint}</p>
              </div>
            ))}
          </div>
        )}

        {stats && stats.pendingWithdrawals > 0 ? (
          <div className="mt-8 rounded-3xl border border-cyan-400/30 bg-cyan-400/10 p-5">
            <p className="text-sm font-semibold text-cyan-300">
              {t("pendingAlert", { count: stats.pendingWithdrawals })}
            </p>
            <Link
              href={ADMIN_ROUTES.withdrawals}
              className="mt-3 inline-flex rounded-xl bg-gradient-to-r from-cyan-400 to-cyan-300 px-4 py-2 text-sm font-bold text-[#041016] shadow-[0_12px_40px_rgba(34,211,238,0.22)]"
            >
              {t("reviewWithdrawals")}
            </Link>
          </div>
        ) : null}

        <div className="mt-8 flex flex-wrap gap-3">
          <Link
            href={ADMIN_ROUTES.withdrawals}
            className="rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-sm font-semibold text-slate-300 hover:bg-white/10"
          >
            {t("goWithdrawals")}
          </Link>
          <Link
            href={ADMIN_ROUTES.users}
            className="rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-sm font-semibold text-slate-300 hover:bg-white/10"
          >
            {t("goUsers")}
          </Link>
        </div>
      </main>
    </div>
  );
}
