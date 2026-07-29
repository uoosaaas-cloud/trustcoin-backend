"use client";

import { useTranslations } from "next-intl";
import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { AppNav } from "@/components/AppNav";
import { usePollingReload } from "@/hooks/usePollingReload";
import { getStoredAuthToken, getApiErrorMessage } from "@/lib/api";
import { formatUsdt } from "@/lib/format";
import { listUserTrades, type TradeItem } from "@/lib/trades";

const headCellClass = "px-4 py-3 text-center text-xs font-semibold uppercase tracking-wide";
const bodyCellClass = "px-4 py-3 text-center align-middle";

export default function UserTradesPage() {
  const t = useTranslations("trades");
  const tCommon = useTranslations("common");
  const router = useRouter();

  const [trades, setTrades] = useState<TradeItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [enabled, setEnabled] = useState(false);

  useEffect(() => {
    if (!getStoredAuthToken()) {
      router.replace("/login?next=/trades/");
      return;
    }
    setEnabled(true);
  }, [router]);

  const load = useCallback(async () => {
    if (!getStoredAuthToken()) return;
    try {
      const response = await listUserTrades();
      setTrades(response.data);
      setErrorMessage(null);
    } catch (error) {
      setErrorMessage(getApiErrorMessage(error, tCommon("unknownError")));
    } finally {
      setIsLoading(false);
    }
  }, [tCommon]);

  usePollingReload(load, enabled, 15_000);

  function outcomeLabel(outcome: TradeItem["outcome"]) {
    if (outcome === "PROFITABLE") return t("outcome.profitable");
    if (outcome === "LOSS") return t("outcome.loss");
    return t("outcome.pending");
  }

  function sideLabel(side: TradeItem["side"]) {
    return side === "BUY" ? t("side.buy") : t("side.sell");
  }

  return (
    <div className="page-shell">
      <AppNav />
      <main className="relative z-10 mx-auto max-w-5xl flex-1 px-4 pb-16 pt-7 sm:px-6">
        <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-cyan-200/90 sm:text-xs">{t("eyebrow")}</p>
        <h1 className="mt-2.5 text-2xl font-bold tracking-tight text-white sm:text-[2rem] sm:leading-tight">{t("title")}</h1>
        <p className="mt-2.5 max-w-2xl text-[15px] leading-relaxed text-slate-300">{t("subtitle")}</p>

        {errorMessage ? (
          <p className="mt-6 rounded-xl border border-rose-400/25 bg-rose-500/10 px-4 py-3 text-sm text-rose-200">
            {errorMessage}
          </p>
        ) : null}

        <div className="table-surface mt-8 overflow-x-auto">
          <table className="w-full min-w-[720px] table-fixed text-sm">
            <colgroup>
              <col className="w-[14%]" />
              <col className="w-[14%]" />
              <col className="w-[18%]" />
              <col className="w-[16%]" />
              <col className="w-[38%]" />
            </colgroup>
            <thead>
              <tr className="border-b border-white/10 bg-white/[0.06] text-slate-400">
                <th className={headCellClass}>{t("columns.symbol")}</th>
                <th className={headCellClass}>{t("columns.side")}</th>
                <th className={headCellClass}>{t("columns.amount")}</th>
                <th className={headCellClass}>{t("columns.outcome")}</th>
                <th className={headCellClass}>{t("columns.time")}</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr>
                  <td colSpan={5} className="px-4 py-10 text-center text-slate-400">
                    …
                  </td>
                </tr>
              ) : trades.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-4 py-10 text-center text-slate-400">
                    {t("empty")}
                  </td>
                </tr>
              ) : (
                trades.map((trade) => (
                  <tr key={trade.id} className="border-b border-white/10 last:border-0 hover:bg-white/[0.06]">
                    <td className={bodyCellClass}>
                      <span dir="ltr" className="inline-block font-mono text-sm font-semibold tracking-wide text-white">
                        {trade.symbol}
                      </span>
                    </td>
                    <td className={bodyCellClass}>
                      <span
                        className={`inline-flex items-center justify-center rounded-lg px-2.5 py-1 text-xs font-bold ${
                          trade.side === "SELL"
                            ? "border border-rose-400/30 bg-rose-500/10 text-rose-300"
                            : "border border-cyan-300/30 bg-cyan-400/10 text-cyan-200"
                        }`}
                      >
                        {sideLabel(trade.side)}
                      </span>
                    </td>
                    <td className={`${bodyCellClass} font-semibold text-slate-100`}>
                      <span dir="ltr" className="inline-block tabular-nums">
                        {formatUsdt(trade.amount)}$
                      </span>
                    </td>
                    <td className={bodyCellClass}>
                      <span
                        className={`text-sm font-semibold ${
                          trade.outcome === "PROFITABLE"
                            ? "text-cyan-200"
                            : trade.outcome === "LOSS"
                              ? "text-rose-300"
                              : "text-amber-200"
                        }`}
                      >
                        {outcomeLabel(trade.outcome)}
                      </span>
                      {trade.note ? (
                        <p className="mt-0.5 text-xs text-slate-400">{trade.note}</p>
                      ) : null}
                    </td>
                    <td className={`${bodyCellClass} text-xs text-slate-400`}>
                      <span dir="ltr" className="inline-block whitespace-nowrap tabular-nums">
                        {new Date(trade.createdAt).toLocaleString()}
                      </span>
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
