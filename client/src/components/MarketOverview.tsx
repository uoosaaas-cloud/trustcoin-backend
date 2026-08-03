"use client";

import { useEffect, useId, useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import {
  Area,
  AreaChart,
  ResponsiveContainer,
  YAxis,
} from "recharts";
import type { MarketAssetId, MarketAssetPayload } from "@/lib/markets";
import { fetchMarketAssets } from "@/lib/marketData";

const REFRESH_MS = 45_000;

function formatUsdPrice(price: number, id: MarketAssetId): string {
  if (id === "trx") {
    return price.toLocaleString("en-US", {
      minimumFractionDigits: 4,
      maximumFractionDigits: 5,
    });
  }
  if (id === "wti") {
    return price.toLocaleString("en-US", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
  }
  if (price >= 1000) {
    return price.toLocaleString("en-US", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
  }
  return price.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 4,
  });
}

function formatChange(change: number): string {
  const abs = Math.abs(change).toFixed(2);
  return `${change >= 0 ? "+" : "−"}${abs}%`;
}

function AssetIcon({ id }: { id: MarketAssetId }) {
  const common = "h-9 w-9";
  switch (id) {
    case "btc":
      return (
        <svg viewBox="0 0 32 32" className={common} aria-hidden>
          <circle cx="16" cy="16" r="16" fill="#F7931A" />
          <path
            fill="#fff"
            d="M21.6 14.3c.3-2-1.2-3.1-3.3-3.8l.7-2.7-1.6-.4-.7 2.6c-.4-.1-.9-.2-1.3-.3l.7-2.6-1.6-.4-.7 2.7c-.3-.1-.7-.2-1-.3l-2.2-.5-.4 1.7s1.2.3 1.2.3c.7.2.8.6.8 1l-.8 3.1c0 0 .1 0 .2.1h-.2l-1.1 4.3c-.1.2-.3.5-.8.4 0 0-1.2-.3-1.2-.3l-.8 1.8 2.1.5c.4.1.8.2 1.1.3l-.7 2.8 1.6.4.7-2.7c.4.1.9.2 1.3.3l-.7 2.7 1.6.4.7-2.8c2.9.5 5 .3 5.9-2.3.7-2.1 0-3.3-1.5-4.1 1.1-.2 1.9-1 2.1-2.6zm-3.8 5.3c-.5 2.1-4 1-5.1.7l.9-3.6c1.1.3 4.7.8 4.2 2.9zm.5-5.3c-.5 1.9-3.3.9-4.3.7l.8-3.3c.9.2 4 .7 3.5 2.6z"
          />
        </svg>
      );
    case "eth":
      return (
        <svg viewBox="0 0 32 32" className={common} aria-hidden>
          <circle cx="16" cy="16" r="16" fill="#627EEA" />
          <path fill="#fff" fillOpacity=".6" d="M16.5 4v8.9l7.5 3.3L16.5 4z" />
          <path fill="#fff" d="M16.5 4 9 16.2l7.5-3.3V4z" />
          <path fill="#fff" fillOpacity=".6" d="M16.5 21.9v6.1l7.5-10.4-7.5 4.3z" />
          <path fill="#fff" d="M16.5 28v-6.1L9 17.6 16.5 28z" />
          <path fill="#fff" fillOpacity=".2" d="M16.5 20.6l7.5-4.4-7.5-3.3v7.7z" />
          <path fill="#fff" fillOpacity=".6" d="M9 16.2l7.5 4.4v-7.7L9 16.2z" />
        </svg>
      );
    case "bnb":
      return (
        <svg viewBox="0 0 32 32" className={common} aria-hidden>
          <circle cx="16" cy="16" r="16" fill="#F3BA2F" />
          <path
            fill="#fff"
            d="M12.1 14.5 16 10.6l3.9 3.9 2.3-2.3L16 6l-6.2 6.2 2.3 2.3zm-4.4 1.5L5.4 16l2.3 2.3 2.3-2.3-2.3-2.3zm8.3 0-2.8 2.8-1.1-1.1-.6-.6-2.3 2.3L16 26l6.2-6.2-2.3-2.3-.7.6-1.1 1.1-2.8-2.8zm8.3-2.3-2.3 2.3 2.3 2.3L26.6 16l-2.3-2.3zM16 13.7l-1.8 1.8-.1.1-1 1 1 1 .1.1L16 18.3l1.9-1.9.1-.1 1-1-1-1-.1-.1L16 13.7z"
          />
        </svg>
      );
    case "trx":
      return (
        <svg viewBox="0 0 32 32" className={common} aria-hidden>
          <circle cx="16" cy="16" r="16" fill="#EF0027" />
          <path
            fill="#fff"
            d="m22.8 8.2-12.4 3.5c-.3.1-.5.3-.6.6L7.2 22.6c-.1.4.3.7.6.5l13.7-7.2c.4-.2.5-.7.3-1L23.2 8.8c-.1-.3-.3-.5-.4-.6zm-3.3 2.7-6.3 5.7-.8-4.7 7.1-1zm-7.6 6.6 1.1 5.9-5.4-2.9 4.3-3zm1.7 5.2-.8-4.6 5.9-5.3-5.1 9.9z"
          />
        </svg>
      );
    case "xau":
      return (
        <svg viewBox="0 0 32 32" className={common} aria-hidden>
          <circle cx="16" cy="16" r="16" fill="#D4A017" />
          <path
            fill="#fff"
            d="M16 7.2 9.5 21.5h3.1l1.1-2.8h4.6l1.1 2.8h3.1L16 7.2zm0 4.1 1.6 4.1h-3.2L16 11.3z"
          />
        </svg>
      );
    case "wti":
      return (
        <svg viewBox="0 0 32 32" className={common} aria-hidden>
          <circle cx="16" cy="16" r="16" fill="#1F2937" />
          <path
            fill="#F59E0B"
            d="M16 6c0 0-6 7.2-6 12.2A6 6 0 0 0 16 24a6 6 0 0 0 6-5.8C22 13.2 16 6 16 6zm0 15.2a3.4 3.4 0 0 1-3.4-3.3c0-2.5 2.1-5.7 3.4-7.5 1.3 1.8 3.4 5 3.4 7.5a3.4 3.4 0 0 1-3.4 3.3z"
          />
        </svg>
      );
    default:
      return null;
  }
}

function MiniSparkline({
  points,
  positive,
}: {
  points: number[];
  positive: boolean;
}) {
  const gradientId = useId().replace(/:/g, "");
  const data = useMemo(
    () => points.map((value, index) => ({ i: index, value })),
    [points]
  );

  const stroke = positive ? "#22c55e" : "#f43f5e";
  const fillFrom = positive ? "rgba(34,197,94,0.45)" : "rgba(244,63,94,0.45)";
  const fillTo = positive ? "rgba(34,197,94,0)" : "rgba(244,63,94,0)";

  if (data.length < 2) {
    return <div className="h-[72px] w-full animate-pulse rounded-lg bg-white/5" />;
  }

  return (
    <div className="h-[72px] w-full">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 6, right: 0, left: 0, bottom: 0 }}>
          <defs>
            <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={fillFrom} />
              <stop offset="100%" stopColor={fillTo} />
            </linearGradient>
          </defs>
          <YAxis domain={["dataMin", "dataMax"]} hide />
          <Area
            type="monotone"
            dataKey="value"
            stroke={stroke}
            strokeWidth={2}
            fill={`url(#${gradientId})`}
            isAnimationActive
            animationDuration={700}
            dot={false}
            activeDot={false}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

function MarketCard({ asset }: { asset: MarketAssetPayload }) {
  const positive = asset.change24h >= 0;

  return (
    <article
      dir="ltr"
      className={`group relative overflow-hidden rounded-2xl border border-white/14 bg-white/[0.08] p-4 backdrop-blur-sm transition duration-200 hover:border-cyan-300/35 hover:bg-white/[0.11] sm:p-5 ${
        positive ? "" : ""
      }`}
    >
      <div
        aria-hidden
        className={`pointer-events-none absolute -end-10 -top-12 h-32 w-32 rounded-full blur-3xl transition duration-300 ${
          positive ? "bg-cyan-400/10 opacity-70" : "bg-rose-400/10 opacity-70"
        }`}
      />
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/25 to-transparent"
      />

      <div className="relative flex items-center gap-3">
        <div className="shrink-0 rounded-xl border border-white/14 bg-white/[0.06] p-1.5">
          <AssetIcon id={asset.id} />
        </div>
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold tracking-tight text-white">{asset.name}</p>
          <p className="mt-0.5 font-mono text-[11px] uppercase tracking-[0.14em] text-slate-400">
            {asset.pair}
          </p>
        </div>
        <span
          className={`ms-auto inline-flex shrink-0 items-center rounded-full border px-2.5 py-1 font-mono text-[11px] font-semibold ${
            positive
              ? "border-emerald-400/30 bg-emerald-400/10 text-emerald-300 shadow-[0_0_16px_rgba(52,211,153,0.25)]"
              : "border-rose-400/30 bg-rose-400/10 text-rose-300 shadow-[0_0_16px_rgba(244,63,94,0.25)]"
          }`}
        >
          {formatChange(asset.change24h)}
        </span>
      </div>

      <div className="relative mt-4">
        <p className="font-mono text-[1.65rem] font-bold leading-none tracking-tight text-white sm:text-[1.85rem]">
          <span className="me-1 text-base font-medium text-slate-400">$</span>
          {formatUsdPrice(asset.price, asset.id)}
        </p>
        <p className="mt-1.5 text-[11px] font-medium uppercase tracking-[0.16em] text-slate-400">
          USD · 24h
        </p>
      </div>

      <div className="relative mt-3 overflow-hidden rounded-xl border border-white/10 bg-white/[0.04] px-1 pt-1">
        <MiniSparkline points={asset.sparkline} positive={positive} />
      </div>
    </article>
  );
}

function MarketCardSkeleton() {
  return (
    <div className="h-[220px] animate-pulse rounded-2xl border border-white/10 bg-white/[0.06] p-5 backdrop-blur-sm">
      <div className="flex items-center gap-3">
        <div className="h-9 w-9 rounded-xl bg-white/10" />
        <div className="space-y-2">
          <div className="h-3 w-24 rounded bg-white/10" />
          <div className="h-2.5 w-16 rounded bg-white/5" />
        </div>
      </div>
      <div className="mt-6 h-8 w-36 rounded bg-white/10" />
      <div className="mt-5 h-[72px] rounded-xl bg-white/5" />
    </div>
  );
}

export function MarketOverview() {
  const t = useTranslations("dashboard.markets");
  const [assets, setAssets] = useState<MarketAssetPayload[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshedAt, setRefreshedAt] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const data = await fetchMarketAssets();
        if (cancelled) return;
        if (!data.assets.length) {
          setError(t("error"));
          return;
        }
        setAssets(data.assets);
        setRefreshedAt(data.refreshedAt);
        setError(null);
      } catch {
        if (!cancelled) {
          setError(t("error"));
        }
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    }

    void load();
    const timer = window.setInterval(() => void load(), REFRESH_MS);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [t]);

  return (
    <section className="mt-10" aria-label={t("title")}>
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
        <div className="flex items-center gap-2">
          <span className="inline-flex items-center gap-2 rounded-full border border-cyan-300/30 bg-cyan-400/10 px-3 py-1 text-[11px] font-semibold text-cyan-200">
            <span className="relative flex h-1.5 w-1.5">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-cyan-400 opacity-60" />
              <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-cyan-400" />
            </span>
            {t("live")}
          </span>
          {refreshedAt ? (
            <span className="hidden font-mono text-[10px] text-slate-400 sm:inline" dir="ltr">
              {new Date(refreshedAt).toLocaleTimeString("en-US", {
                hour: "2-digit",
                minute: "2-digit",
                second: "2-digit",
              })}
            </span>
          ) : null}
        </div>
      </div>

      {error ? (
        <div className="mb-4 rounded-xl border border-rose-400/25 bg-rose-500/10 px-4 py-3 text-sm text-rose-200">
          {error}
        </div>
      ) : null}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {isLoading && assets.length === 0
          ? Array.from({ length: 6 }).map((_, index) => <MarketCardSkeleton key={index} />)
          : assets.map((asset) => <MarketCard key={asset.id} asset={asset} />)}
      </div>
    </section>
  );
}
