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
          accent: "from-brand-50 to-white border-brand-200",
        },
        {
          key: "deposits",
          label: t("totalDeposits"),
          value: `${formatUsdt(stats.totalDeposits)} USDT`,
          hint: t("totalDepositsHint"),
          accent: "from-green-50 to-white border-green-200",
        },
        {
          key: "withdrawals",
          label: t("totalWithdrawals"),
          value: `${formatUsdt(stats.totalWithdrawals)} USDT`,
          hint: t("totalWithdrawalsHint"),
          accent: "from-blue-50 to-white border-blue-200",
        },
        {
          key: "investments",
          label: t("activeInvestments"),
          value: String(stats.totalActiveInvestments),
          hint: t("activeInvestmentsHint"),
          accent: "from-slate-50 to-white border-slate-200",
        },
      ]
    : [];

  return (
    <div className="page-shell">
      <AdminNav />

      <main className="relative z-10 mx-auto max-w-6xl px-4 py-8 sm:px-6">
        <div className="mb-8">
          <p className="text-xs font-semibold uppercase tracking-widest text-gold-500">{t("eyebrow")}</p>
          <h1 className="mt-2 text-2xl font-bold text-slate-900 sm:text-3xl">{t("title")}</h1>
          <p className="mt-2 text-sm text-slate-600">{t("subtitle")}</p>
        </div>

        {errorMessage ? (
          <div className="mb-6 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
            {errorMessage}
          </div>
        ) : null}

        {isLoading ? (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {[0, 1, 2, 3].map((i) => (
              <div key={i} className="h-32 animate-pulse rounded-3xl border border-slate-200 bg-white" />
            ))}
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {cards.map((card) => (
              <div
                key={card.key}
                className={`rounded-3xl border bg-gradient-to-br to-white p-5 shadow-sm ${card.accent}`}
              >
                <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">{card.label}</p>
                <p className="mt-3 text-2xl font-bold text-slate-900">{card.value}</p>
                <p className="mt-2 text-xs text-slate-500">{card.hint}</p>
              </div>
            ))}
          </div>
        )}

        {stats && stats.pendingWithdrawals > 0 ? (
          <div className="mt-8 rounded-3xl border border-blue-200 bg-blue-50 p-5">
            <p className="text-sm font-semibold text-blue-700">
              {t("pendingAlert", { count: stats.pendingWithdrawals })}
            </p>
            <Link
              href={ADMIN_ROUTES.withdrawals}
              className="mt-3 inline-flex rounded-xl bg-gradient-to-r from-brand-500 to-gold-500 px-4 py-2 text-sm font-semibold text-white shadow-md"
            >
              {t("reviewWithdrawals")}
            </Link>
          </div>
        ) : null}

        <div className="mt-8 flex flex-wrap gap-3">
          <Link
            href={ADMIN_ROUTES.withdrawals}
            className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 shadow-sm hover:bg-slate-50"
          >
            {t("goWithdrawals")}
          </Link>
          <Link
            href={ADMIN_ROUTES.users}
            className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 shadow-sm hover:bg-slate-50"
          >
            {t("goUsers")}
          </Link>
        </div>
      </main>
    </div>
  );
}
