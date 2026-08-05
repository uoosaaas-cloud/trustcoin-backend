"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { useSilentPoll } from "@/hooks/useSilentPoll";
import { getApiErrorMessage } from "@/lib/api";
import { formatDate, formatUsdt } from "@/lib/format";
import {
  durationKeyFromPackage,
  EARNINGS_ACCRUAL_STEP_MS,
  getDailyProfitUsdt,
  getDaysRemaining,
  getInvestmentProgress,
  getLiveTotalEarned,
  getMyInvestments,
  getPeriodReturnPercent,
  msUntilNextEarningsStep,
  type InvestmentRecord,
} from "@/lib/investments";

const POLL_MS = 30_000;

type MyInvestmentsProps = {
  /** When true, show active packages only (dashboard). */
  compact?: boolean;
  /** Bump to force a refresh after purchase. */
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
    intervalMs: POLL_MS,
    runImmediately: false,
  });

  const active = investments.filter((inv) => inv.status === "ACTIVE");
  const completed = investments.filter((inv) => inv.status === "COMPLETED");
  const visible = compact ? active : [...active, ...completed];

  return (
    <section className={compact ? "mt-10" : "mb-8"} aria-label={t("title")}>
      <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-cyan-200/90 sm:text-xs">
            {t("eyebrow")}
          </p>
          <h2 className="mt-1.5 text-xl font-bold tracking-tight text-white sm:text-2xl">
            {t("title")}
          </h2>
          <p className="mt-1 text-[13px] text-slate-400 sm:text-sm">{t("subtitle")}</p>
        </div>
        {active.length > 0 ? (
          <span className="inline-flex items-center gap-2 rounded-full border border-cyan-300/30 bg-cyan-400/10 px-3 py-1 text-[11px] font-semibold text-cyan-200">
            <span className="relative flex h-1.5 w-1.5">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-cyan-400 opacity-60" />
              <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-cyan-400" />
            </span>
            {t("activeCount", { count: active.length })}
          </span>
        ) : null}
      </div>

      {error ? (
        <div className="mb-4 rounded-xl border border-rose-400/25 bg-rose-500/10 px-4 py-3 text-sm text-rose-200">
          {error}
        </div>
      ) : null}

      {isLoading ? (
        <div className="grid gap-4 sm:grid-cols-2">
          {[0, 1].map((i) => (
            <div
              key={i}
              className="h-52 animate-pulse rounded-2xl border border-white/10 bg-white/[0.06]"
            />
          ))}
        </div>
      ) : visible.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-white/14 bg-white/[0.05] px-5 py-8 text-center backdrop-blur-sm">
          <p className="text-sm font-medium text-slate-300">{t("empty")}</p>
          <p className="mt-1.5 text-[13px] text-slate-500">{t("emptyHint")}</p>
          {compact ? (
            <Link
              href="/invest"
              className="mt-5 inline-flex items-center justify-center rounded-xl bg-gradient-to-r from-cyan-300 to-cyan-200 px-5 py-2.5 text-sm font-bold text-[#041016] shadow-[0_8px_24px_rgba(34,211,238,0.18)] transition hover:brightness-105"
            >
              {t("ctaInvest")}
            </Link>
          ) : null}
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {visible.map((inv) => {
            const durationKey = durationKeyFromPackage(inv.package);
            return (
              <InvestmentCard
                key={inv.id}
                investment={inv}
                durationLabel={tInvest(`duration.${durationKey}`)}
                periodReturnLabel={tInvest(`periodReturn.${durationKey}`)}
                periodReturn={getPeriodReturnPercent(inv.package)}
              />
            );
          })}
        </div>
      )}

      {compact && completed.length > 0 ? (
        <p className="mt-3 text-center text-[12px] text-slate-500">
          {t("completedHint", { count: completed.length })}{" "}
          <Link href="/invest" className="font-semibold text-cyan-300/90 hover:text-cyan-200">
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

    let intervalId: number | undefined;

    const tick = () => setNow(Date.now());

    const delay = msUntilNextEarningsStep(investment.start_date);
    const timeoutId = window.setTimeout(() => {
      tick();
      intervalId = window.setInterval(tick, EARNINGS_ACCRUAL_STEP_MS);
    }, delay);

    return () => {
      window.clearTimeout(timeoutId);
      if (intervalId !== undefined) window.clearInterval(intervalId);
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
    <article className="group relative overflow-hidden rounded-2xl border border-white/14 bg-white/[0.08] p-5 backdrop-blur-sm transition duration-200 hover:border-cyan-300/35 hover:bg-white/[0.11] sm:p-6">
      <div
        aria-hidden
        className="pointer-events-none absolute -end-10 -top-12 h-36 w-36 rounded-full bg-cyan-400/10 blur-3xl"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/25 to-transparent"
      />

      <div className="relative flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate text-base font-semibold tracking-tight text-white">
            {formatUsdt(investment.invested_amount)}{" "}
            <span className="text-sm font-medium text-cyan-200/80">USDT</span>
          </p>
          <p className="mt-1 text-[12px] text-slate-400">
            {durationLabel} · {investment.package.duration_days} {t("days")}
          </p>
        </div>
        <span
          className={`inline-flex shrink-0 items-center rounded-full border px-2.5 py-1 text-[11px] font-semibold ${
            isActive
              ? "border-cyan-400/30 bg-cyan-400/10 text-cyan-200"
              : "border-emerald-400/30 bg-emerald-400/10 text-emerald-300"
          }`}
        >
          {isActive ? t("statusActive") : t("statusCompleted")}
        </span>
      </div>

      <div className="relative mt-5 grid grid-cols-2 gap-3">
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

      <div className="relative mt-5">
        <div className="mb-1.5 flex items-center justify-between text-[11px] text-slate-400">
          <span>{formatDate(investment.start_date)}</span>
          <span>{formatDate(investment.end_date)}</span>
        </div>
        <div className="h-1.5 overflow-hidden rounded-full bg-white/10">
          <div
            className={`h-full rounded-full transition-all duration-500 ${
              isActive
                ? "bg-gradient-to-r from-cyan-400 to-cyan-200"
                : "bg-emerald-400/80"
            }`}
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
  live = false,
}: {
  label: string;
  value: string;
  suffix?: string;
  accent?: boolean;
  live?: boolean;
}) {
  return (
    <div className="rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2.5">
      <p className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-500">
        {label}
        {live ? (
          <span className="relative flex h-1.5 w-1.5">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-cyan-400 opacity-60" />
            <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-cyan-400" />
          </span>
        ) : null}
      </p>
      <p
        className={`mt-1 font-bold tracking-tight tabular-nums ${
          live ? "text-base text-cyan-200 transition-all duration-300" : "text-sm"
        } ${accent && !live ? "text-cyan-200" : ""} ${!accent && !live ? "text-white" : ""} ${
          accent && live ? "" : ""
        } ${!live && !accent ? "text-white" : ""}`}
      >
        <span className={live || accent ? "text-cyan-200" : "text-white"}>{value}</span>
        {suffix ? <span className="ms-1 text-[11px] font-medium text-slate-400">{suffix}</span> : null}
      </p>
    </div>
  );
}
