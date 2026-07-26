"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useEffect, useState } from "react";
import { AppNav } from "@/components/AppNav";
import { MarketOverview } from "@/components/MarketOverview";
import { TrustComplianceBlock } from "@/components/TrustCompliance";
import { useWallet } from "@/contexts/WalletContext";
import { getStoredAuthToken } from "@/lib/api";
import { formatUsdt } from "@/lib/format";

type BalanceCard = {
  key: "total" | "locked" | "available";
  label: string;
  hint: string;
  value: string;
  badge: string;
  valueClass: string;
  shell: string;
  glow: string;
  bar: string;
};

export default function DashboardPage() {
  const router = useRouter();
  const t = useTranslations("dashboard");
  const { wallet, isLoading, error, refreshWallet } = useWallet();

  const [isAuthChecked, setIsAuthChecked] = useState(false);

  useEffect(() => {
    if (!getStoredAuthToken()) {
      router.replace("/login?next=/dashboard");
      return;
    }
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setIsAuthChecked(true);
  }, [router]);

  useEffect(() => {
    if (!isAuthChecked) return;
    // Prefer silent refresh — WalletProvider already owns the initial load + 10s poll.
    void refreshWallet({ silent: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAuthChecked]);

  if (!isAuthChecked) {
    return null;
  }

  const cards: BalanceCard[] = wallet
    ? [
        {
          key: "total",
          label: t("totalBalance"),
          hint: t("totalHint"),
          value: wallet.totalBalance,
          badge: "TOTAL",
          valueClass: "text-slate-900",
          shell:
            "border-brand-200/80 bg-gradient-to-br from-brand-50/90 via-white/80 to-white/70 shadow-[0_8px_32px_rgba(239,68,68,0.12)]",
          glow: "bg-brand-400/25",
          bar: "from-brand-400 to-brand-600",
        },
        {
          key: "locked",
          label: t("lockedBalance"),
          hint: t("lockedHint"),
          value: wallet.lockedBalance,
          badge: "LOCKED",
          valueClass: "text-blue-600",
          shell:
            "border-blue-200/80 bg-gradient-to-br from-blue-50/90 via-white/80 to-cyan-50/50 shadow-[0_8px_32px_rgba(59,130,246,0.14)]",
          glow: "bg-blue-400/30",
          bar: "from-blue-400 to-cyan-500",
        },
        {
          key: "available",
          label: t("availableBalance"),
          hint: t("availableHint"),
          value: wallet.availableBalance,
          badge: "LIQUID",
          valueClass: "text-green-600",
          shell:
            "border-green-200/80 bg-gradient-to-br from-green-50/90 via-white/80 to-emerald-50/40 shadow-[0_8px_32px_rgba(34,197,94,0.14)]",
          glow: "bg-emerald-400/30",
          bar: "from-emerald-400 to-green-600",
        },
      ]
    : [];

  const actions = [
    {
      href: "/invest",
      label: t("ctaInvest"),
      primary: true,
      icon: (
        <path
          d="M12 3v18M7 8l5-5 5 5M7 16l5 5 5-5"
          stroke="currentColor"
          strokeWidth="1.75"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      ),
    },
    {
      href: "/deposit",
      label: t("ctaDeposit"),
      primary: false,
      tone: "border-blue-200/80 text-blue-700 hover:bg-blue-50/80",
      icon: (
        <path
          d="M12 5v14M5 12h14"
          stroke="currentColor"
          strokeWidth="1.75"
          strokeLinecap="round"
        />
      ),
    },
    {
      href: "/withdraw",
      label: t("ctaWithdraw"),
      primary: false,
      tone: "border-emerald-200/80 text-emerald-700 hover:bg-emerald-50/80",
      icon: (
        <path
          d="M12 19V5M5 12l7-7 7 7"
          stroke="currentColor"
          strokeWidth="1.75"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      ),
    },
    {
      href: "/referrals",
      label: t("ctaReferrals"),
      primary: false,
      tone: "border-slate-200 text-slate-700 hover:bg-slate-50",
      icon: (
        <path
          d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2M16 3.13a4 4 0 0 1 0 7.75M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8Z"
          stroke="currentColor"
          strokeWidth="1.75"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      ),
    },
  ] as const;

  return (
    <div className="page-shell flex flex-col">
      <AppNav />

      <main className="relative z-10 mx-auto w-full max-w-6xl flex-1 px-4 pb-20 pt-7 sm:px-6">
        {/* Hero header */}
        <section className="relative mb-8 overflow-hidden rounded-[1.75rem] border border-white/70 bg-white/55 p-6 shadow-[0_12px_40px_rgba(15,23,42,0.06)] backdrop-blur-xl sm:p-8">
          <div
            aria-hidden
            className="pointer-events-none absolute -end-16 -top-20 h-56 w-56 rounded-full bg-blue-400/20 blur-3xl"
          />
          <div
            aria-hidden
            className="pointer-events-none absolute -bottom-24 -start-10 h-48 w-48 rounded-full bg-brand-400/15 blur-3xl"
          />
          <div
            aria-hidden
            className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-blue-300/70 to-transparent"
          />

          <div className="relative flex flex-wrap items-start justify-between gap-4">
            <div className="max-w-2xl">
              <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-brand-500 sm:text-xs">
                {t("eyebrow")}
              </p>
              <h1 className="mt-2.5 text-3xl font-bold tracking-tight text-slate-900 sm:text-[2.35rem] sm:leading-tight">
                {t("title")}
              </h1>
              <p className="mt-3 text-[15px] leading-relaxed text-slate-600 sm:text-base">
                {t("subtitle")}
              </p>
            </div>

            <span className="inline-flex items-center gap-2 rounded-full border border-emerald-200/80 bg-emerald-50/90 px-3.5 py-1.5 text-xs font-semibold text-emerald-700 shadow-[0_0_20px_rgba(34,197,94,0.18)]">
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-60" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
              </span>
              {t("liveBadge")}
            </span>
          </div>
        </section>

        {/* Exact same Register trust block */}
        <div className="mb-8">
          <TrustComplianceBlock compact />
        </div>

        {error ? (
          <div className="mb-6 rounded-2xl border border-rose-200 bg-rose-50/90 px-4 py-3 text-sm text-rose-700 backdrop-blur-sm">
            {error}
          </div>
        ) : null}

        {/* Portfolio widgets */}
        <div className="mb-3 flex items-center justify-between gap-3">
          <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-500 sm:text-xs">
            {t("portfolioLabel")}
          </p>
        </div>

        {isLoading ? (
          <div className="grid gap-4 sm:grid-cols-3">
            {[0, 1, 2].map((i) => (
              <div
                key={i}
                className="h-44 animate-pulse rounded-[1.5rem] border border-slate-200/80 bg-white/70 backdrop-blur-sm"
              />
            ))}
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-3">
            {cards.map((card) => (
              <article
                key={card.key}
                className={`group relative overflow-hidden rounded-[1.5rem] border p-5 backdrop-blur-xl transition duration-300 hover:-translate-y-1 hover:shadow-[0_16px_40px_rgba(15,23,42,0.1)] sm:p-6 ${card.shell}`}
              >
                <div
                  aria-hidden
                  className={`pointer-events-none absolute -end-8 -top-10 h-28 w-28 rounded-full blur-3xl ${card.glow}`}
                />
                <div
                  aria-hidden
                  className={`pointer-events-none absolute inset-x-0 top-0 h-1 bg-gradient-to-r ${card.bar} opacity-80`}
                />

                <div className="relative flex items-center justify-between gap-2">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500 sm:text-xs">
                    {card.label}
                  </p>
                  <span
                    dir="ltr"
                    className="rounded-md border border-white/80 bg-white/70 px-2 py-0.5 font-mono text-[10px] font-semibold tracking-wider text-slate-500 shadow-sm"
                  >
                    {card.badge}
                  </span>
                </div>

                <p className={`relative mt-4 text-3xl font-bold tracking-tight sm:text-[2rem] ${card.valueClass}`}>
                  {formatUsdt(card.value)}
                  <span className="ms-1.5 text-sm font-medium text-slate-500">USDT</span>
                </p>
                <p className="relative mt-3 text-[13px] leading-relaxed text-slate-500">{card.hint}</p>
              </article>
            ))}
          </div>
        )}

        {wallet && Number(wallet.pendingWithdrawalBalance) > 0 ? (
          <div className="mt-4 rounded-2xl border border-amber-200/80 bg-amber-50/80 px-4 py-3 text-[14px] text-amber-800 backdrop-blur-sm">
            {t("pendingWithdrawal", { amount: formatUsdt(wallet.pendingWithdrawalBalance) })}
          </div>
        ) : null}

        <MarketOverview />

        {/* Quick actions */}
        <div className="mt-10 mb-3">
          <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-500 sm:text-xs">
            {t("actionsLabel")}
          </p>
        </div>

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {actions.map((action) => (
            <Link
              key={action.href}
              href={action.href}
              className={
                action.primary
                  ? "group relative inline-flex items-center justify-center gap-2.5 overflow-hidden rounded-2xl bg-gradient-to-r from-brand-500 to-brand-600 px-5 py-4 text-sm font-semibold text-white shadow-[0_10px_28px_rgba(239,68,68,0.28)] transition duration-200 hover:-translate-y-0.5 hover:brightness-110"
                  : `inline-flex items-center justify-center gap-2.5 rounded-2xl border bg-white/75 px-5 py-4 text-sm font-semibold shadow-[0_4px_18px_rgba(15,23,42,0.04)] backdrop-blur-md transition duration-200 hover:-translate-y-0.5 ${action.tone}`
              }
            >
              {action.primary ? (
                <span
                  aria-hidden
                  className="pointer-events-none absolute inset-0 bg-[linear-gradient(120deg,transparent_35%,rgba(255,255,255,0.18)_50%,transparent_65%)] opacity-0 transition group-hover:opacity-100"
                />
              ) : null}
              <svg viewBox="0 0 24 24" fill="none" className="relative h-4 w-4" aria-hidden>
                {action.icon}
              </svg>
              <span className="relative">{action.label}</span>
            </Link>
          ))}
        </div>
      </main>
    </div>
  );
}
