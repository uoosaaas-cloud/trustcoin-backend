"use client";

import { useTranslations } from "next-intl";
import { useEffect, useState } from "react";
import { AdminNav } from "@/components/AdminNav";
import { useRequireAdmin } from "@/hooks/useRequireAdmin";
import {
  approveWithdrawal,
  getPendingWithdrawals,
  rejectWithdrawal,
  type AdminPendingWithdrawal,
} from "@/lib/admin";
import { getApiErrorMessage } from "@/lib/api";
import { formatUsdt, formatDateTime } from "@/lib/format";

export default function AdminWithdrawalsPage() {
  const ready = useRequireAdmin();
  const t = useTranslations("admin.withdrawals");
  const tCommon = useTranslations("common");

  const [rows, setRows] = useState<AdminPendingWithdrawal[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  async function load() {
    setErrorMessage(null);
    try {
      const response = await getPendingWithdrawals();
      setRows(response.data);
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

  useEffect(() => {
    if (!copiedId) return;
    const timer = window.setTimeout(() => setCopiedId(null), 1800);
    return () => window.clearTimeout(timer);
  }, [copiedId]);

  async function handleCopyAddress(rowId: string, address: string) {
    try {
      await navigator.clipboard.writeText(address);
      setCopiedId(rowId);
    } catch {
      // Fallback for older browsers / insecure contexts
      const textarea = document.createElement("textarea");
      textarea.value = address;
      textarea.setAttribute("readonly", "");
      textarea.style.position = "fixed";
      textarea.style.opacity = "0";
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand("copy");
      document.body.removeChild(textarea);
      setCopiedId(rowId);
    }
  }

  async function handleApprove(id: string) {
    setBusyId(id);
    setErrorMessage(null);
    setSuccessMessage(null);
    try {
      await approveWithdrawal(id);
      setSuccessMessage(t("approved"));
      await load();
    } catch (error) {
      setErrorMessage(getApiErrorMessage(error, t("errors.actionFailed")));
    } finally {
      setBusyId(null);
    }
  }

  async function handleReject(id: string) {
    setBusyId(id);
    setErrorMessage(null);
    setSuccessMessage(null);
    try {
      await rejectWithdrawal(id);
      setSuccessMessage(t("rejected"));
      await load();
    } catch (error) {
      setErrorMessage(getApiErrorMessage(error, t("errors.actionFailed")));
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
          <p className="text-xs font-semibold uppercase tracking-widest text-cyan-300">{t("eyebrow")}</p>
          <h1 className="mt-2 text-2xl font-bold text-white sm:text-3xl">{t("title")}</h1>
          <p className="mt-2 text-sm text-slate-400">{t("subtitle")}</p>
        </div>

        {errorMessage ? (
          <div className="mb-4 rounded-2xl border border-rose-400/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-300">
            {errorMessage}
          </div>
        ) : null}
        {successMessage ? (
          <div className="mb-4 rounded-2xl border border-cyan-400/25 bg-cyan-400/10 px-4 py-3 text-sm text-cyan-200">
            {successMessage}
          </div>
        ) : null}

        {copiedId ? (
          <div
            role="status"
            className="fixed bottom-6 start-1/2 z-50 -translate-x-1/2 rounded-xl border border-emerald-400/30 bg-white/5 px-4 py-2.5 text-sm font-semibold text-emerald-300 shadow-lg shadow-slate-900/10"
          >
            {t("copied")}
          </div>
        ) : null}

        {isLoading ? (
          <div className="h-40 animate-pulse rounded-2xl border border-white/10 bg-white/5" />
        ) : rows.length === 0 ? (
          <p className="text-sm text-slate-400">{t("empty")}</p>
        ) : (
          <div className="table-surface">
            <table className="w-full min-w-[860px] text-left text-sm">
              <thead className="border-b border-white/10 bg-white/[0.03] text-xs uppercase tracking-wider text-slate-400">
                <tr>
                  <th className="px-4 py-3 font-medium">{t("table.user")}</th>
                  <th className="px-4 py-3 font-medium">{t("table.amount")}</th>
                  <th className="min-w-[280px] px-4 py-3 font-medium">{t("table.address")}</th>
                  <th className="px-4 py-3 font-medium">{t("table.date")}</th>
                  <th className="px-4 py-3 font-medium">{t("table.actions")}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {rows.map((row) => {
                  const address = row.payment_address?.trim() || null;
                  const justCopied = copiedId === row.id;

                  return (
                    <tr key={row.id} className="text-slate-300 hover:bg-white/5/80">
                      <td className="px-4 py-3 align-top">
                        <p className="font-medium text-white">{row.user.email}</p>
                        <p className="text-xs text-slate-400">
                          {t("availableNow", { amount: formatUsdt(row.user.balance) })}
                        </p>
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 align-top font-semibold text-cyan-300">
                        {formatUsdt(row.amount)} USDT
                      </td>
                      <td className="px-4 py-3 align-top">
                        {address ? (
                          <div className="flex items-start gap-2">
                            <code
                              dir="ltr"
                              className="block min-w-0 flex-1 break-all rounded-lg border border-white/10 bg-white/[0.03] px-2.5 py-2 font-mono text-[12px] leading-relaxed text-slate-100"
                            >
                              {address}
                            </code>
                            <button
                              type="button"
                              onClick={() => void handleCopyAddress(row.id, address)}
                              aria-label={t("copyAddress")}
                              title={justCopied ? t("copied") : t("copyAddress")}
                              className={`inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border transition ${
                                justCopied
                                  ? "border-emerald-400/30 bg-emerald-500/10 text-emerald-300"
                                  : "border-white/10 bg-white/5 text-slate-400 hover:border-cyan-400/25 hover:bg-cyan-400/10 hover:text-cyan-300"
                              }`}
                            >
                              {justCopied ? <CheckIcon /> : <CopyIcon />}
                            </button>
                          </div>
                        ) : (
                          <span className="text-slate-400">—</span>
                        )}
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 align-top text-xs text-slate-400">
                        {formatDateTime(row.created_at)}
                      </td>
                      <td className="px-4 py-3 align-top">
                        <div className="flex flex-wrap gap-2">
                          <button
                            type="button"
                            disabled={busyId === row.id}
                            onClick={() => void handleApprove(row.id)}
                            className="rounded-lg border border-emerald-400/30 bg-emerald-500/10 px-3 py-1.5 text-xs font-semibold text-emerald-300 transition hover:bg-green-100 disabled:opacity-50"
                          >
                            {busyId === row.id ? "…" : t("approve")}
                          </button>
                          <button
                            type="button"
                            disabled={busyId === row.id}
                            onClick={() => void handleReject(row.id)}
                            className="rounded-lg border border-rose-400/30 bg-rose-500/10 px-3 py-1.5 text-xs font-semibold text-rose-300 transition hover:bg-rose-500/20 disabled:opacity-50"
                          >
                            {busyId === row.id ? "…" : t("reject")}
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </main>
    </div>
  );
}

function CopyIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" className="h-4 w-4" aria-hidden>
      <rect x="9" y="9" width="11" height="11" rx="2" stroke="currentColor" strokeWidth="1.75" />
      <path
        d="M5 15V7a2 2 0 0 1 2-2h8"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
      />
    </svg>
  );
}

function CheckIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" className="h-4 w-4" aria-hidden>
      <path
        d="M5 13l4 4L19 7"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
