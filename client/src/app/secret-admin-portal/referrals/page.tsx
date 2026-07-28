"use client";

import { useTranslations } from "next-intl";
import { useCallback, useEffect, useState } from "react";
import { AdminNav } from "@/components/AdminNav";
import { useRequireAdmin } from "@/hooks/useRequireAdmin";
import {
  approveAdminReferral,
  getAdminReferralOverview,
  rejectAdminReferral,
  type AdminReferralAuditRow,
  type AdminReferralOverview,
} from "@/lib/admin";
import { getApiErrorMessage } from "@/lib/api";
import { formatDate, formatUsdt } from "@/lib/format";

function StatusBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    PENDING_PACKAGE_ACTIVE: "border-amber-200 bg-amber-50 text-amber-200",
    PACKAGE_COMPLETED_AWAITING_ADMIN: "border-cyan-400/30 bg-cyan-400/10 text-cyan-200",
    APPROVED_RELEASED: "border-emerald-400/30 bg-emerald-500/10 text-emerald-200",
    REJECTED: "border-rose-400/30 bg-rose-500/10 text-rose-300",
  };

  return (
    <span
      className={`inline-flex max-w-[14rem] items-center rounded-md border px-2 py-1 text-[10px] font-semibold uppercase tracking-wide ${
        styles[status] ?? "border-white/10 bg-white/[0.03] text-slate-400"
      }`}
    >
      {status}
    </span>
  );
}

export default function AdminReferralsPage() {
  const ready = useRequireAdmin();
  const t = useTranslations("admin.referrals");
  const tCommon = useTranslations("common");

  const [overview, setOverview] = useState<AdminReferralOverview | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [actionMessage, setActionMessage] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setIsLoading(true);
    setErrorMessage(null);
    try {
      const response = await getAdminReferralOverview();
      setOverview(response.data);
    } catch (error) {
      setErrorMessage(getApiErrorMessage(error, tCommon("unknownError")));
    } finally {
      setIsLoading(false);
    }
  }, [tCommon]);

  useEffect(() => {
    if (!ready) return;
    void load();
    const id = window.setInterval(() => {
      void load();
    }, 10_000);
    return () => window.clearInterval(id);
  }, [ready, load]);

  async function handleApprove(row: AdminReferralAuditRow) {
    setBusyId(row.id);
    setActionMessage(null);
    setErrorMessage(null);
    try {
      await approveAdminReferral(row.id);
      setActionMessage(t("actions.approved"));
      await load();
    } catch (error) {
      setErrorMessage(getApiErrorMessage(error, tCommon("unknownError")));
    } finally {
      setBusyId(null);
    }
  }

  async function handleReject(row: AdminReferralAuditRow) {
    setBusyId(row.id);
    setActionMessage(null);
    setErrorMessage(null);
    try {
      await rejectAdminReferral(row.id);
      setActionMessage(t("actions.rejected"));
      await load();
    } catch (error) {
      setErrorMessage(getApiErrorMessage(error, tCommon("unknownError")));
    } finally {
      setBusyId(null);
    }
  }

  if (!ready) return null;

  return (
    <div className="page-shell">
      <AdminNav />

      <main className="relative z-10 mx-auto max-w-7xl px-4 py-8 sm:px-6">
        <div className="mb-8">
          <p className="text-xs font-semibold uppercase tracking-widest text-cyan-300">{t("eyebrow")}</p>
          <h1 className="mt-2 text-2xl font-bold text-white sm:text-3xl">{t("title")}</h1>
          <p className="mt-2 max-w-3xl text-sm text-slate-400">{t("subtitle")}</p>
        </div>

        {errorMessage ? (
          <div className="mb-4 rounded-2xl border border-rose-400/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-300">
            {errorMessage}
          </div>
        ) : null}
        {actionMessage ? (
          <div className="mb-4 rounded-2xl border border-emerald-400/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-300">
            {actionMessage}
          </div>
        ) : null}

        {isLoading || !overview ? (
          <div className="h-40 animate-pulse rounded-2xl border border-white/10 bg-white/5" />
        ) : (
          <div className="space-y-6">
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <StatCard label={t("stats.referrers")} value={String(overview.totalReferrers)} />
              <StatCard label={t("stats.referred")} value={String(overview.totalReferredUsers)} />
              <StatCard
                label={t("stats.pending")}
                value={`${formatUsdt(overview.totalPendingCommission)} USDT`}
              />
              <StatCard
                label={t("stats.commission")}
                value={`${formatUsdt(overview.totalCommissionPaid)} USDT`}
                accent
              />
            </div>

            {overview.awaitingAdminCount > 0 ? (
              <div className="rounded-2xl border border-cyan-400/30 bg-cyan-400/10 px-4 py-3 text-sm text-cyan-200">
                {t("awaitingAlert", { count: overview.awaitingAdminCount })}
              </div>
            ) : null}

            <section className="card-surface rounded-3xl p-4 sm:p-5">
              <h2 className="text-lg font-semibold text-white">{t("auditTitle")}</h2>
              <p className="mt-1 text-sm text-slate-400">{t("auditSubtitle")}</p>

              {overview.auditRows.length === 0 ? (
                <p className="mt-4 text-sm text-slate-400">{t("emptyAudit")}</p>
              ) : (
                <div className="table-surface mt-4 overflow-x-auto border-0 shadow-none">
                  <table className="w-full min-w-[1100px] text-left text-sm">
                    <thead className="border-b border-white/10 bg-white/[0.03] text-xs uppercase tracking-wider text-slate-400">
                      <tr>
                        <th className="px-3 py-2 font-medium">{t("table.referrer")}</th>
                        <th className="px-3 py-2 font-medium">{t("table.referee")}</th>
                        <th className="px-3 py-2 font-medium">{t("table.package")}</th>
                        <th className="px-3 py-2 font-medium">{t("table.profit")}</th>
                        <th className="px-3 py-2 font-medium">{t("table.commission")}</th>
                        <th className="px-3 py-2 font-medium">{t("table.status")}</th>
                        <th className="px-3 py-2 font-medium">{t("table.actions")}</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {overview.auditRows.map((row) => (
                        <tr key={row.id} className="align-top hover:bg-white/5/80">
                          <td className="px-3 py-3">
                            <p className="font-medium text-white">{row.referrer.display_name}</p>
                            <p className="text-xs text-slate-400">{row.referrer.email}</p>
                            <p className="mt-1 font-mono text-[11px] text-slate-400" dir="ltr">
                              {row.referrer.wallet_address ?? t("noWallet")}
                            </p>
                          </td>
                          <td className="px-3 py-3">
                            <p className="font-medium text-white">{row.referee.display_name}</p>
                            <p className="text-xs text-slate-400">{row.referee.email}</p>
                            <p className="mt-1 text-[11px] text-slate-400">
                              {row.referee.registration_status === "SUCCESS"
                                ? t("regSuccess")
                                : t("regPendingKyc")}{" "}
                              · {formatDate(row.referee.created_at)}
                            </p>
                          </td>
                          <td className="px-3 py-3">
                            <p className="font-medium text-white">{row.investment.packageName}</p>
                            <p className="text-xs text-slate-400">
                              {formatUsdt(row.investment.invested_amount)} USDT
                            </p>
                            <p className="mt-1 text-[11px] text-slate-400">
                              {formatDate(row.investment.start_date)} → {formatDate(row.investment.end_date)}
                            </p>
                          </td>
                          <td className="px-3 py-3 font-semibold text-slate-100">
                            {formatUsdt(row.expected_profit)} USDT
                          </td>
                          <td className="px-3 py-3">
                            <p className="font-semibold text-emerald-400">
                              {formatUsdt(row.bonus_amount)} USDT
                            </p>
                            <p className="text-[11px] text-slate-400">
                              {formatUsdt(row.bonus_percentage)}% {t("ofProfit")}
                            </p>
                          </td>
                          <td className="px-3 py-3">
                            <StatusBadge status={row.status} />
                          </td>
                          <td className="px-3 py-3">
                            <div className="flex flex-col gap-2">
                              <button
                                type="button"
                                disabled={!row.canApprove || busyId === row.id}
                                onClick={() => void handleApprove(row)}
                                className="rounded-lg bg-green-600 px-3 py-1.5 text-xs font-semibold text-white disabled:cursor-not-allowed disabled:bg-slate-200 disabled:text-slate-400"
                              >
                                {busyId === row.id ? t("actions.working") : t("actions.approve")}
                              </button>
                              <button
                                type="button"
                                disabled={!row.canReject || busyId === row.id}
                                onClick={() => void handleReject(row)}
                                className="rounded-lg border border-rose-200 bg-white/5 px-3 py-1.5 text-xs font-semibold text-rose-300 disabled:cursor-not-allowed disabled:border-white/10 disabled:text-slate-400"
                              >
                                {t("actions.reject")}
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </section>
          </div>
        )}
      </main>
    </div>
  );
}

function StatCard({ label, value, accent = false }: { label: string; value: string; accent?: boolean }) {
  return (
    <div className="card-surface rounded-3xl p-4 sm:p-5">
      <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">{label}</p>
      <p className={`mt-2 text-2xl font-bold ${accent ? "text-emerald-400" : "text-white"}`}>{value}</p>
    </div>
  );
}
