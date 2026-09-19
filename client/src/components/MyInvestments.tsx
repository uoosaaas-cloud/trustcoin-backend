"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { useSilentPoll } from "@/hooks/useSilentPoll";
import { getApiErrorMessage } from "@/lib/api";
import { formatDate, formatUsdt } from "@/lib/format";
import {
  durationKeyFromPackage,
  EARNINGS_TICK_MS,
  getDailyProfitUsdt,
  getDaysRemaining,
  getInvestmentProgress,
  getLiveTotalEarned,
  getMyInvestments,
  getPeriodReturnPercent,
  type InvestmentRecord,
} from "@/lib/investments";

type MyInvestmentsProps = {
  compact?: boolean;
  refreshToken?: number;
};

export function MyInvestments({ compact = false, refreshToken = 0 }: MyInvestmentsProps) {
  const t = useTranslations("dashboard.myPackages");
  const tInvest = useTranslations("invest");
  const tCommon = useTranslations("common");

  const [investments, setInvestments] = useState<InvestmentRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(
    async (opts?: { silent?: boolean }) => {
      try {
        const response = await getMyInvestments();
        setInvestments(response.data);
        setError(null);
      } catch (err) {
        if (!opts?.silent) {
          setError(getApiErrorMessage(err, tCommon("unknownError")));
        }
      } finally {
        if (!opts?.silent) setIsLoading(false);
      }
    },
    [tCommon]
  );

  useEffect(() => {
    void load();
  }, [load, refreshToken]);

  useSilentPoll(() => load({ silent: true }), {
    enabled: true,
    intervalMs: 30_000,
    runImmediately: false,
  });

  const active = investments.filter((inv) => inv.status === "ACTIVE");
  const completed = investments.filter((inv) => inv.status === "COMPLETED");
  const visible = compact ? active : [...active, ...completed];

  return (
    <section className={compact ? "mt-10" : "mb-8"} aria-label={t("title")}>
      <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-brand-500 sm:text-xs">
            {t("eyebrow")}
          </p>
          <h2 className="mt-1.5 text-xl font-bold tracking-tight text-slate-900 sm:text-2xl">{t("title")}</h2>
          <p className="mt-1 text-[13px] text-slate-500 sm:text-sm">{t("subtitle")}</p>
        </div>
        {active.length > 0 ? (
          <span className="inline-flex items-center gap-2 rounded-full border border-emerald-200/80 bg-emerald-50 px-3 py-1 text-[11px] font-semibold text-emerald-700">
            {t("activeCount", { count: active.length })}
          </span>
        ) : null}
      </div>

      {error ? (
        <div className="mb-4 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          {error}
        </div>
      ) : null}

      {isLoading ? (
        <div className="grid gap-4 sm:grid-cols-2">
          {[0, 1].map((i) => (
            <div key={i} className="h-52 animate-pulse rounded-2xl border border-slate-200 bg-white" />
          ))}
        </div>
      ) : visible.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-200 bg-white px-5 py-8 text-center">
          <p className="text-sm font-medium text-slate-700">{t("empty")}</p>
          <p className="mt-1.5 text-[13px] text-slate-500">{t("emptyHint")}</p>
          {compact ? (
            <Link
              href="/invest"
              className="mt-5 inline-flex items-center justify-center rounded-xl bg-gradient-to-r from-brand-500 to-brand-600 px-5 py-2.5 text-sm font-semibold text-white"
            >
              {t("ctaInvest")}
            </Link>
          ) : null}
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {visible.map((inv) => {
            const key = durationKeyFromPackage(inv.package);
            return (
              <InvestmentCard
                key={inv.id}
                investment={inv}
                durationLabel={tInvest(`duration.${key}`)}
                periodReturnLabel={tInvest(`periodReturn.${key}`)}
                periodReturn={getPeriodReturnPercent(inv.package)}
              />
            );
          })}
        </div>
      )}

      {compact && completed.length > 0 ? (
        <p className="mt-3 text-center text-[12px] text-slate-500">
          {t("completedHint", { count: completed.length })}{" "}
          <Link href="/invest" className="font-semibold text-brand-600 hover:text-brand-700">
            {t("viewOnInvest")}
          </Link>
        </p>
      ) : null}
    </section>
  );
}

function useLiveTotalEarned(investment: InvestmentRecord): number {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (investment.status !== "ACTIVE") return;

    const tick = () => setNow(Date.now());
    tick();
    const intervalId = window.setInterval(tick, EARNINGS_TICK_MS);

    function onVisibility() {
      if (document.visibilityState === "visible") tick();
    }
    document.addEventListener("visibilitychange", onVisibility);

    return () => {
      window.clearInterval(intervalId);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [investment.status, investment.id, investment.start_date]);

  return getLiveTotalEarned(investment, now);
}

function formatLiveUsdt(value: number): string {
  return value.toLocaleString("en-US", {
    minimumFractionDigits: 4,
    maximumFractionDigits: 6,
  });
}

function InvestmentCard({
  investment,
  durationLabel,
  periodReturnLabel,
  periodReturn,
}: {
  investment: InvestmentRecord;
  durationLabel: string;
  periodReturnLabel: string;
  periodReturn: string;
}) {
  const t = useTranslations("dashboard.myPackages");
  const isActive = investment.status === "ACTIVE";
  const progress = getInvestmentProgress(investment);
  const daysLeft = getDaysRemaining(investment);
  const dailyProfit = getDailyProfitUsdt(investment);
  const liveEarned = useLiveTotalEarned(investment);

  return (
    <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate text-base font-semibold tracking-tight text-slate-900">
            {formatUsdt(investment.invested_amount)}{" "}
            <span className="text-sm font-medium text-slate-500">USDT</span>
          </p>
          <p className="mt-1 text-[12px] text-slate-500">
            {durationLabel} · {investment.package.duration_days} {t("days")}
          </p>
        </div>
        <span
          className={`inline-flex shrink-0 items-center rounded-full border px-2.5 py-1 text-[11px] font-semibold ${
            isActive
              ? "border-emerald-200 bg-emerald-50 text-emerald-700"
              : "border-slate-200 bg-slate-50 text-slate-600"
          }`}
        >
          {isActive ? t("statusActive") : t("statusCompleted")}
        </span>
      </div>

      <div className="mt-5 grid grid-cols-2 gap-3">
        <Metric label={t("dailyProfit")} value={`+${formatUsdt(dailyProfit)}`} suffix="USDT" accent />
        <Metric
          label={t("totalEarned")}
          value={isActive ? formatLiveUsdt(liveEarned) : formatUsdt(investment.total_earned)}
          suffix="USDT"
          accent={isActive}
        />
        <Metric label={periodReturnLabel} value={`${periodReturn}%`} />
        <Metric
          label={isActive ? t("daysLeft") : t("matured")}
          value={isActive ? String(daysLeft) : formatDate(investment.end_date)}
          suffix={isActive ? t("days") : undefined}
        />
      </div>

      <div className="mt-5">
        <div className="mb-1.5 flex items-center justify-between text-[11px] text-slate-400">
          <span>{formatDate(investment.start_date)}</span>
          <span>{formatDate(investment.end_date)}</span>
        </div>
        <div className="h-1.5 overflow-hidden rounded-full bg-slate-100">
          <div
            className={`h-full rounded-full ${isActive ? "bg-gradient-to-r from-brand-400 to-brand-600" : "bg-emerald-400"}`}
            style={{ width: `${progress}%` }}
          />
        </div>
        <p className="mt-1.5 text-[11px] font-medium text-slate-500">
          {isActive ? t("progressActive", { percent: Math.round(progress) }) : t("progressDone")}
        </p>
      </div>
    </article>
  );
}

function Metric({
  label,
  value,
  suffix,
  accent = false,
}: {
  label: string;
  value: string;
  suffix?: string;
  accent?: boolean;
}) {
  return (
    <div className="rounded-xl border border-slate-100 bg-slate-50/80 px-3 py-2.5">
      <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-500">{label}</p>
      <p className={`mt-1 text-sm font-bold tracking-tight tabular-nums ${accent ? "text-brand-600" : "text-slate-900"}`}>
        {value}
        {suffix ? <span className="ms-1 text-[11px] font-medium text-slate-400">{suffix}</span> : null}
      </p>
    </div>
  );
}
