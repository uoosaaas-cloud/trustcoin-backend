"use client";

import { useTranslations } from "next-intl";
import { useCallback, useState } from "react";
import { AdminNav } from "@/components/AdminNav";
import { useRequireAdmin } from "@/hooks/useRequireAdmin";
import { usePollingReload } from "@/hooks/usePollingReload";
import { getApiErrorMessage } from "@/lib/api";
import { formatUsdt } from "@/lib/format";
import {
  createAdminTrade,
  deleteAdminTrade,
  listAdminTrades,
  updateAdminTrade,
  type TradeItem,
  type TradeOutcome,
  type TradeSide,
} from "@/lib/trades";

export default function AdminTradesPage() {
  const ready = useRequireAdmin();
  const t = useTranslations("admin.trades");
  const tCommon = useTranslations("common");

  const [trades, setTrades] = useState<TradeItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [symbol, setSymbol] = useState("AUXUSD");
  const [side, setSide] = useState<TradeSide>("SELL");
  const [amount, setAmount] = useState("5000");
  const [outcome, setOutcome] = useState<TradeOutcome>("PROFITABLE");
  const [note, setNote] = useState("");

  const load = useCallback(async () => {
    try {
      const response = await listAdminTrades();
      setTrades(response.data);
      setErrorMessage(null);
    } catch (error) {
      setErrorMessage(getApiErrorMessage(error, tCommon("unknownError")));
    } finally {
      setIsLoading(false);
    }
  }, [tCommon]);

  usePollingReload(load, ready, 10_000);

  async function handleCreate(event: React.FormEvent) {
    event.preventDefault();
    setSuccessMessage(null);
    setErrorMessage(null);
    const parsedAmount = Number(amount);
    if (!symbol.trim() || !Number.isFinite(parsedAmount) || parsedAmount <= 0) {
      setErrorMessage(t("errors.invalid"));
      return;
    }

    setIsSubmitting(true);
    try {
      await createAdminTrade({
        symbol: symbol.trim(),
        side,
        amount: parsedAmount,
        outcome,
        note: note.trim() || null,
        isActive: true,
      });
      setSuccessMessage(t("created"));
      setNote("");
      await load();
    } catch (error) {
      setErrorMessage(getApiErrorMessage(error, t("errors.generic")));
    } finally {
      setIsSubmitting(false);
    }
  }

  async function toggleActive(trade: TradeItem) {
    try {
      await updateAdminTrade(trade.id, { isActive: !trade.isActive });
      await load();
    } catch (error) {
      setErrorMessage(getApiErrorMessage(error, t("errors.generic")));
    }
  }

  async function handleDelete(tradeId: string) {
    if (!window.confirm(t("confirmDelete"))) return;
    try {
      await deleteAdminTrade(tradeId);
      await load();
    } catch (error) {
      setErrorMessage(getApiErrorMessage(error, t("errors.generic")));
    }
  }

  if (!ready) return null;

  return (
    <div className="page-shell">
      <AdminNav />
      <main className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-cyan-300">{t("eyebrow")}</p>
        <h1 className="mt-2 text-3xl font-bold text-white">{t("title")}</h1>
        <p className="mt-2 max-w-2xl text-sm text-slate-400">{t("subtitle")}</p>
        <p className="mt-1 text-xs text-slate-400">{t("autoRefresh")}</p>

        <form onSubmit={handleCreate} className="card-surface mt-8 grid gap-4 p-6 sm:grid-cols-2 lg:grid-cols-3">
          <label className="block text-sm">
            <span className="mb-1.5 block font-medium text-slate-300">{t("form.symbol")}</span>
            <input
              className="input-surface font-mono uppercase"
              value={symbol}
              onChange={(e) => setSymbol(e.target.value)}
              placeholder="AUXUSD"
              required
            />
          </label>
          <label className="block text-sm">
            <span className="mb-1.5 block font-medium text-slate-300">{t("form.side")}</span>
            <select className="input-surface" value={side} onChange={(e) => setSide(e.target.value as TradeSide)}>
              <option value="SELL">{t("side.sell")}</option>
              <option value="BUY">{t("side.buy")}</option>
            </select>
          </label>
          <label className="block text-sm">
            <span className="mb-1.5 block font-medium text-slate-300">{t("form.amount")}</span>
            <input
              className="input-surface"
              type="number"
              min="0.01"
              step="0.01"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              required
            />
          </label>
          <label className="block text-sm">
            <span className="mb-1.5 block font-medium text-slate-300">{t("form.outcome")}</span>
            <select
              className="input-surface"
              value={outcome}
              onChange={(e) => setOutcome(e.target.value as TradeOutcome)}
            >
              <option value="PROFITABLE">{t("outcome.profitable")}</option>
              <option value="LOSS">{t("outcome.loss")}</option>
              <option value="PENDING">{t("outcome.pending")}</option>
            </select>
          </label>
          <label className="block text-sm sm:col-span-2">
            <span className="mb-1.5 block font-medium text-slate-300">{t("form.note")}</span>
            <input
              className="input-surface"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder={t("form.notePlaceholder")}
            />
          </label>
          <div className="flex items-end sm:col-span-2 lg:col-span-3">
            <button
              type="submit"
              disabled={isSubmitting}
              className="rounded-xl bg-cyan-400/100 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-brand-600 disabled:opacity-60"
            >
              {isSubmitting ? t("form.submitting") : t("form.submit")}
            </button>
          </div>
        </form>

        {errorMessage ? (
          <p className="mt-4 rounded-xl border border-rose-400/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-300">
            {errorMessage}
          </p>
        ) : null}
        {successMessage ? (
          <p className="mt-4 rounded-xl border border-emerald-400/30 bg-emerald-50 px-4 py-3 text-sm text-emerald-300">
            {successMessage}
          </p>
        ) : null}

        <div className="table-surface mt-8">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="border-b border-white/10 text-start text-xs uppercase tracking-wide text-slate-400">
                <th className="px-4 py-3">{t("columns.symbol")}</th>
                <th className="px-4 py-3">{t("columns.side")}</th>
                <th className="px-4 py-3">{t("columns.amount")}</th>
                <th className="px-4 py-3">{t("columns.outcome")}</th>
                <th className="px-4 py-3">{t("columns.status")}</th>
                <th className="px-4 py-3">{t("columns.actions")}</th>
              </tr>
            </thead>
            <tbody>
                  {isLoading ? (
                <tr>
                  <td colSpan={6} className="px-4 py-10 text-center text-slate-400">
                    …
                  </td>
                </tr>
              ) : trades.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-10 text-center text-slate-400">
                    {t("empty")}
                  </td>
                </tr>
              ) : (
                trades.map((trade) => (
                  <tr key={trade.id} className="border-b border-white/5 last:border-0">
                    <td className="px-4 py-3 font-mono font-semibold">{trade.symbol}</td>
                    <td className="px-4 py-3">{trade.side === "SELL" ? t("side.sell") : t("side.buy")}</td>
                    <td className="px-4 py-3" dir="ltr">
                      {formatUsdt(trade.amount)}$
                    </td>
                    <td className="px-4 py-3">
                      {trade.outcome === "PROFITABLE"
                        ? t("outcome.profitable")
                        : trade.outcome === "LOSS"
                          ? t("outcome.loss")
                          : t("outcome.pending")}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`rounded-lg px-2 py-0.5 text-xs font-semibold ${
                          trade.isActive ? "bg-emerald-50 text-emerald-300" : "bg-white/10 text-slate-400"
                        }`}
                      >
                        {trade.isActive ? t("status.active") : t("status.hidden")}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap gap-2">
                        <button
                          type="button"
                          onClick={() => void toggleActive(trade)}
                          className="rounded-lg border border-white/10 px-2.5 py-1 text-xs font-medium text-slate-400 hover:border-cyan-400/25 hover:text-cyan-300"
                        >
                          {trade.isActive ? t("actions.hide") : t("actions.show")}
                        </button>
                        <button
                          type="button"
                          onClick={() => void handleDelete(trade.id)}
                          className="rounded-lg border border-red-200 px-2.5 py-1 text-xs font-medium text-red-600 hover:bg-red-50"
                        >
                          {t("actions.delete")}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </main>
    </div>
  );
}
