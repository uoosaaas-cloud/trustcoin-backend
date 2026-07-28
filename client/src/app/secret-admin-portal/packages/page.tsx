"use client";

import { useTranslations } from "next-intl";
import { useEffect, useState } from "react";
import { AdminNav } from "@/components/AdminNav";
import { useRequireAdmin } from "@/hooks/useRequireAdmin";
import {
  getAdminPackages,
  updateAdminPackage,
  type AdminPackageRow,
} from "@/lib/admin";
import { getApiErrorMessage } from "@/lib/api";
import { formatUsdt } from "@/lib/format";

export default function AdminPackagesPage() {
  const ready = useRequireAdmin();
  const t = useTranslations("admin.packages");
  const tCommon = useTranslations("common");

  const [packages, setPackages] = useState<AdminPackageRow[]>([]);
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [busyId, setBusyId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  async function load() {
    setIsLoading(true);
    setErrorMessage(null);
    try {
      const response = await getAdminPackages();
      setPackages(response.data);
      const next: Record<string, string> = {};
      for (const pkg of response.data) {
        next[pkg.id] = pkg.daily_profit_percent;
      }
      setDrafts(next);
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

  async function handleSave(pkg: AdminPackageRow) {
    const value = (drafts[pkg.id] ?? "").trim();
    if (!value || Number(value) <= 0) {
      setErrorMessage(t("errors.invalidRate"));
      return;
    }

    setBusyId(pkg.id);
    setErrorMessage(null);
    setSuccessMessage(null);
    try {
      await updateAdminPackage(pkg.id, { daily_profit_percent: value });
      setSuccessMessage(t("saved", { name: pkg.name }));
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
      <main className="relative z-10 mx-auto max-w-6xl px-4 py-8 sm:px-6">
        <div className="mb-8">
          <p className="text-xs font-semibold uppercase tracking-widest text-gold-500">{t("eyebrow")}</p>
          <h1 className="mt-2 text-2xl font-bold text-slate-900 sm:text-3xl">{t("title")}</h1>
          <p className="mt-2 max-w-3xl text-sm text-slate-600">{t("subtitle")}</p>
        </div>

        {errorMessage ? (
          <div className="mb-4 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
            {errorMessage}
          </div>
        ) : null}
        {successMessage ? (
          <div className="mb-4 rounded-2xl border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700">
            {successMessage}
          </div>
        ) : null}

        {isLoading ? (
          <div className="h-40 animate-pulse rounded-2xl border border-slate-200 bg-white" />
        ) : (
          <div className="table-surface overflow-x-auto">
            <table className="w-full min-w-[880px] text-left text-sm">
              <thead className="border-b border-slate-200 bg-slate-50 text-xs uppercase tracking-wider text-slate-500">
                <tr>
                  <th className="px-4 py-3 font-medium">{t("table.name")}</th>
                  <th className="px-4 py-3 font-medium">{t("table.amount")}</th>
                  <th className="px-4 py-3 font-medium">{t("table.duration")}</th>
                  <th className="px-4 py-3 font-medium">{t("table.rate")}</th>
                  <th className="px-4 py-3 font-medium">{t("table.active")}</th>
                  <th className="px-4 py-3 font-medium">{t("table.actions")}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {packages.map((pkg) => (
                  <tr key={pkg.id} className="hover:bg-slate-50/80">
                    <td className="px-4 py-3 font-medium text-slate-900">{pkg.name}</td>
                    <td className="px-4 py-3 text-slate-700">{formatUsdt(pkg.amount)} USDT</td>
                    <td className="px-4 py-3 text-slate-700">{pkg.duration_days}d</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <input
                          type="number"
                          step="0.0001"
                          min="0.0001"
                          max="9.9999"
                          value={drafts[pkg.id] ?? ""}
                          onChange={(e) =>
                            setDrafts((prev) => ({ ...prev, [pkg.id]: e.target.value }))
                          }
                          className="input-surface w-28 py-2 text-sm"
                        />
                        <span className="text-xs text-slate-500">%/day</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-slate-700">{pkg.activeInvestments}</td>
                    <td className="px-4 py-3">
                      <button
                        type="button"
                        disabled={busyId === pkg.id || drafts[pkg.id] === pkg.daily_profit_percent}
                        onClick={() => void handleSave(pkg)}
                        className="rounded-lg bg-brand-600 px-3 py-1.5 text-xs font-semibold text-white disabled:cursor-not-allowed disabled:bg-slate-200 disabled:text-slate-400"
                      >
                        {busyId === pkg.id ? t("saving") : t("save")}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <p className="border-t border-slate-100 px-4 py-3 text-xs text-slate-500">{t("note")}</p>
          </div>
        )}
      </main>
    </div>
  );
}
