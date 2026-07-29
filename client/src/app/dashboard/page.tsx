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
          valueClass: "text-white",
        },
        {
          key: "locked",
          label: t("lockedBalance"),
          hint: t("lockedHint"),
          value: wallet.lockedBalance,
          badge: "LOCKED",
          valueClass: "text-cyan-100",
        },
        {
          key: "available",
          label: t("availableBalance"),
          hint: t("availableHint"),
          value: wallet.availableBalance,
          badge: "LIQUID",
          valueClass: "text-cyan-100",
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
      tone: "border-white/14 text-cyan-200 hover:border-cyan-300/35 hover:bg-white/[0.11]",
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
      tone: "border-white/14 text-cyan-200 hover:border-cyan-300/35 hover:bg-white/[0.11]",
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
      tone: "border-white/14 text-slate-200 hover:border-cyan-300/35 hover:bg-white/[0.11]",
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
        <section className="relative mb-8 overflow-hidden rounded-2xl border border-white/14 bg-white/[0.08] p-6 backdrop-blur-sm sm:p-8">
          <div
            aria-hidden
            className="pointer-events-none absolute -end-16 -top-20 h-56 w-56 rounded-full bg-cyan-400/15 blur-3xl"
          />
          <div
            aria-hidden
            className="pointer-events-none absolute -bottom-24 -start-10 h-48 w-48 rounded-full bg-cyan-400/10 blur-3xl"
          />
          <div
            aria-hidden
            className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-cyan-300/40 to-transparent"
          />

          <div className="relative flex flex-wrap items-start justify-between gap-4">
            <div className="max-w-2xl">
              <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-cyan-200/90 sm:text-xs">
                {t("eyebrow")}
              </p>
              <h1 className="mt-2.5 text-3xl font-bold tracking-tight text-white sm:text-[2.35rem] sm:leading-tight">
                {t("title")}
              </h1>
              <p className="mt-3 text-[15px] leading-relaxed text-slate-300 sm:text-base">
                {t("subtitle")}
              </p>
            </div>

            <span className="inline-flex items-center gap-2 rounded-full border border-cyan-300/30 bg-cyan-400/10 px-3.5 py-1.5 text-xs font-semibold text-cyan-200 shadow-[0_0_20px_rgba(34,211,238,0.12)]">
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-cyan-400 opacity-60" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-cyan-400" />
              </span>
              {t("liveBadge")}
            </span>
          </div>
        </section>

        {error ? (
          <div className="mb-6 rounded-xl border border-rose-400/25 bg-rose-500/10 px-4 py-3 text-sm text-rose-200 backdrop-blur-sm">
            {error}
          </div>
        ) : null}

        {/* Portfolio widgets */}
        <div className="mb-3 flex items-center justify-between gap-3">
          <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-300 sm:text-xs">
            {t("portfolioLabel")}
          </p>
        </div>

        {isLoading ? (
          <div className="grid gap-4 sm:grid-cols-3">
            {[0, 1, 2].map((i) => (
              <div
                key={i}
                className="h-44 animate-pulse rounded-2xl border border-white/10 bg-white/[0.06]"
              />
            ))}
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-3">
            {cards.map((card) => (
              <article
                key={card.key}
                className="group relative overflow-hidden rounded-2xl border border-white/14 bg-white/[0.08] p-5 backdrop-blur-sm transition duration-200 hover:border-cyan-300/35 hover:bg-white/[0.11] sm:p-6"
              >
                <div className="relative flex items-center justify-between gap-2">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-300 sm:text-xs">
                    {card.label}
                  </p>
                  <span
                    dir="ltr"
                    className="rounded-md border border-white/14 bg-white/[0.06] px-2 py-0.5 font-mono text-[10px] font-semibold tracking-wider text-slate-400"
                  >
                    {card.badge}
                  </span>
                </div>

                <p className={`relative mt-4 text-3xl font-bold tracking-tight sm:text-[2rem] ${card.valueClass}`}>
                  {formatUsdt(card.value)}
                  <span className="ms-1.5 text-sm font-medium text-cyan-200/80">USDT</span>
                </p>
                <p className="relative mt-3 text-[13px] leading-relaxed text-slate-400">{card.hint}</p>
              </article>
            ))}
          </div>
        )}

        {wallet && Number(wallet.pendingWithdrawalBalance) > 0 ? (
          <div className="mt-4 rounded-xl border border-amber-400/25 bg-amber-500/10 px-4 py-3 text-[14px] text-amber-100 backdrop-blur-sm">
            {t("pendingWithdrawal", { amount: formatUsdt(wallet.pendingWithdrawalBalance) })}
          </div>
        ) : null}

        <MarketOverview />

        {/* Quick actions */}
        <div className="mt-10 mb-3">
          <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-300 sm:text-xs">
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
                  ? "group relative inline-flex items-center justify-center gap-2.5 overflow-hidden rounded-2xl bg-gradient-to-r from-cyan-300 to-cyan-200 px-5 py-4 text-sm font-bold text-[#041016] shadow-[0_8px_24px_rgba(34,211,238,0.2)] transition duration-200 hover:-translate-y-0.5 hover:brightness-105"
                  : `inline-flex items-center justify-center gap-2.5 rounded-2xl border bg-white/[0.08] px-5 py-4 text-sm font-semibold backdrop-blur-sm transition duration-200 hover:-translate-y-0.5 ${action.tone}`
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

        <div className="mt-8">
          <TrustComplianceBlock compact />
        </div>
      </main>
    </div>
  );
}
