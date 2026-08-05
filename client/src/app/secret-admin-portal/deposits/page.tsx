"use client";

import { useTranslations } from "next-intl";
import { useEffect, useState, type ReactNode } from "react";
import { AdminNav } from "@/components/AdminNav";
import { useRequireAdmin } from "@/hooks/useRequireAdmin";
import {
  getAdminDepositMonitoring,
  triggerAdminDepositSweep,
  type AdminDepositMonitoring,
} from "@/lib/admin";
import { getApiErrorMessage } from "@/lib/api";
import { formatDate, formatUsdt } from "@/lib/format";

export default function AdminDepositsPage() {
  const ready = useRequireAdmin();
  const t = useTranslations("admin.deposits");
  const tCommon = useTranslations("common");

  const [data, setData] = useState<AdminDepositMonitoring | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSweeping, setIsSweeping] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  async function load() {
    setIsLoading(true);
    setErrorMessage(null);
    try {
      const response = await getAdminDepositMonitoring();
      setData(response.data);
    } catch (error) {
      setErrorMessage(getApiErrorMessage(error, tCommon("unknownError")));
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    if (!ready) return;
    void load();
    const id = window.setInterval(() => {
      void load();
    }, 10_000);
    return () => window.clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready]);

  async function handleSweep(dryRun: boolean) {
    setIsSweeping(true);
    setErrorMessage(null);
    setSuccessMessage(null);
    try {
      await triggerAdminDepositSweep({ dryRun });
      setSuccessMessage(dryRun ? t("sweepDryDone") : t("sweepDone"));
      await load();
    } catch (error) {
      setErrorMessage(getApiErrorMessage(error, tCommon("unknownError")));
    } finally {
      setIsSweeping(false);
    }
  }

  if (!ready) return null;

  return (
    <div className="page-shell">
      <AdminNav />
      <main className="relative z-10 mx-auto max-w-7xl px-4 py-8 sm:px-6">
        <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-widest text-cyan-300">{t("eyebrow")}</p>
            <h1 className="mt-2 text-2xl font-bold text-white sm:text-3xl">{t("title")}</h1>
            <p className="mt-2 max-w-3xl text-sm text-slate-400">{t("subtitle")}</p>
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              disabled={isSweeping}
              onClick={() => void handleSweep(true)}
              className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs font-semibold text-slate-300 disabled:opacity-50"
            >
              {t("drySweep")}
            </button>
            <button
              type="button"
              disabled={isSweeping}
              onClick={() => void handleSweep(false)}
              className="rounded-xl bg-brand-600 px-3 py-2 text-xs font-semibold text-white disabled:opacity-50"
            >
              {isSweeping ? t("sweeping") : t("runSweep")}
            </button>
          </div>
        </div>

        {errorMessage ? (
          <div className="mb-4 rounded-2xl border border-rose-400/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-300">
            {errorMessage}
          </div>
        ) : null}
        {successMessage ? (
          <div className="mb-4 rounded-2xl border border-emerald-400/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-300">
            {successMessage}
          </div>
        ) : null}

        {isLoading || !data ? (
          <div className="h-40 animate-pulse rounded-2xl border border-white/10 bg-white/5" />
        ) : (
          <div className="space-y-6">
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
              <Stat label={t("stats.pendingClaims")} value={String(data.summary.pendingClaims)} />
              <Stat label={t("stats.approvedClaims")} value={String(data.summary.approvedClaims)} />
              <Stat label={t("stats.subWallets")} value={String(data.summary.subWallets)} />
              <Stat label={t("stats.sweepOk")} value={String(data.summary.recentSweepSuccess)} />
              <Stat label={t("stats.sweepFail")} value={String(data.summary.recentSweepFailed)} />
            </div>

            <section className="card-surface rounded-3xl p-4 sm:p-5">
              <h2 className="text-lg font-semibold text-white">{t("systemTitle")}</h2>
              <p className="mt-1 text-sm text-slate-400">{t("systemSubtitle")}</p>
              <div className="mt-4 grid gap-3 sm:grid-cols-3">
                {(["TRC20", "BEP20", "ERC20"] as const).map((network) => (
                  <div key={network} className="rounded-2xl border border-white/10 bg-white/[0.03] p-3">
                    <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">{network}</p>
                    <p className="mt-2 break-all font-mono text-xs text-slate-100" dir="ltr">
                      {data.systemWallets[network]}
                    </p>
                  </div>
                ))}
              </div>
            </section>

            <SectionTable
              title={t("claimsTitle")}
              empty={t("claimsEmpty")}
              rows={data.pendingClaims}
              headers={[t("table.user"), t("table.amount"), t("table.network"), t("table.address"), t("table.date")]}
              render={(row) => (
                <>
                  <td className="px-3 py-2 text-slate-100">{row.user.email}</td>
                  <td className="px-3 py-2 font-semibold">{formatUsdt(row.amount)} USDT</td>
                  <td className="px-3 py-2">{row.network}</td>
                  <td className="max-w-[180px] truncate px-3 py-2 font-mono text-xs" dir="ltr">
                    {row.depositAddress ?? "—"}
                  </td>
                  <td className="px-3 py-2 text-xs text-slate-400">{formatDate(row.created_at)}</td>
                </>
              )}
            />

            <SectionTable
              title={t("walletsTitle")}
              empty={t("walletsEmpty")}
              rows={data.subWallets}
              headers={[t("table.user"), t("table.network"), t("table.address"), t("table.status"), t("table.swept")]}
              render={(row) => (
                <>
                  <td className="px-3 py-2 text-slate-100">{row.user.email}</td>
                  <td className="px-3 py-2">{row.network}</td>
                  <td className="max-w-[200px] truncate px-3 py-2 font-mono text-xs" dir="ltr">
                    {row.address}
                  </td>
                  <td className="px-3 py-2 text-xs">{row.last_sweep_status ?? "—"}</td>
                  <td className="px-3 py-2 text-xs text-slate-400">
                    {row.last_swept_at ? formatDate(row.last_swept_at) : "—"}
                  </td>
                </>
              )}
            />

            <SectionTable
              title={t("sweepsTitle")}
              empty={t("sweepsEmpty")}
              rows={data.recentSweeps}
              headers={[t("table.network"), t("table.amount"), t("table.from"), t("table.status"), t("table.date")]}
              render={(row) => (
                <>
                  <td className="px-3 py-2">{row.network}</td>
                  <td className="px-3 py-2 font-semibold">{formatUsdt(row.amount_usdt)} USDT</td>
                  <td className="max-w-[160px] truncate px-3 py-2 font-mono text-xs" dir="ltr">
                    {row.from_address}
                  </td>
                  <td className="px-3 py-2 text-xs">{row.status}</td>
                  <td className="px-3 py-2 text-xs text-slate-400">{formatDate(row.created_at)}</td>
                </>
              )}
            />
          </div>
        )}
      </main>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="card-surface rounded-3xl p-4">
      <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">{label}</p>
      <p className="mt-2 text-2xl font-bold text-white">{value}</p>
    </div>
  );
}

function SectionTable<T extends { id: string }>({
  title,
  empty,
  rows,
  headers,
  render,
}: {
  title: string;
  empty: string;
  rows: T[];
  headers: string[];
  render: (row: T) => ReactNode;
}) {
  return (
    <section className="card-surface rounded-3xl p-4 sm:p-5">
      <h2 className="text-lg font-semibold text-white">{title}</h2>
      {rows.length === 0 ? (
        <p className="mt-3 text-sm text-slate-400">{empty}</p>
      ) : (
        <div className="table-surface mt-4 overflow-x-auto border-0 shadow-none">
          <table className="w-full min-w-[720px] text-left text-sm">
            <thead className="border-b border-white/10 bg-white/[0.03] text-xs uppercase tracking-wider text-slate-400">
              <tr>
                {headers.map((h) => (
                  <th key={h} className="px-3 py-2 font-medium">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {rows.map((row) => (
                <tr key={row.id} className="hover:bg-white/5/80">
                  {render(row)}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
