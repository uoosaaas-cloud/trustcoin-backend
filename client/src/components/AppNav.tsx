"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useEffect, useState } from "react";
import { AboutPlatformModal } from "@/components/AboutPlatformModal";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";
import { useWallet } from "@/contexts/WalletContext";
import { clearAuthSession } from "@/lib/auth";
import { formatUsdt } from "@/lib/format";
import { getStoredAuthToken } from "@/lib/api";

const NAV_ITEMS = [
  { href: "/dashboard", key: "dashboard" as const },
  { href: "/invest", key: "invest" as const },
  { href: "/deposit", key: "deposit" as const },
  { href: "/withdraw", key: "withdraw" as const },
  { href: "/referrals", key: "referrals" as const },
];

export function AppNav() {
  const pathname = usePathname();
  const router = useRouter();
  const t = useTranslations("nav");
  const { wallet, isLoading, refreshWallet } = useWallet();
  const [aboutOpen, setAboutOpen] = useState(false);

  useEffect(() => {
    if (getStoredAuthToken()) {
      void refreshWallet({ silent: true });
    }
  }, [pathname, refreshWallet]);

  function handleLogout() {
    clearAuthSession();
    router.replace("/login");
  }

  const showWallet = getStoredAuthToken() && wallet;

  const aboutButtonClass =
    "rounded-xl border border-blue-200/70 bg-gradient-to-r from-slate-900 to-slate-800 px-3 py-1.5 text-sm font-semibold text-blue-100 shadow-[0_0_18px_rgba(59,130,246,0.18)] transition hover:border-blue-300 hover:shadow-[0_0_24px_rgba(59,130,246,0.28)]";

  return (
    <>
      <header className="relative z-10 border-b border-slate-200/80 bg-white/85 px-6 py-5 shadow-sm backdrop-blur-md sm:px-10">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-6">
            <Link href="/dashboard" className="flex items-center gap-2">
              <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-brand-500 to-gold-500 text-lg font-bold text-white shadow-lg shadow-brand-500/25">
                T
              </span>
              <span className="text-lg font-semibold tracking-tight text-slate-900">TrustCoin</span>
            </Link>

            <nav className="hidden items-center gap-1 lg:flex">
              {NAV_ITEMS.map((item) => {
                const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={`rounded-xl px-3 py-1.5 text-sm font-medium transition ${
                      active
                        ? "bg-brand-50 text-brand-600"
                        : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
                    }`}
                  >
                    {t(item.key)}
                  </Link>
                );
              })}
              <button type="button" onClick={() => setAboutOpen(true)} className={aboutButtonClass}>
                {t("about")}
              </button>
            </nav>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            {showWallet ? (
              <div className="hidden items-center gap-2 rounded-2xl border border-slate-200 bg-white px-3 py-1.5 text-xs shadow-sm sm:flex">
                <span className="text-slate-500">{t("available")}</span>
                <span className="font-semibold text-green-600">
                  {isLoading ? "…" : formatUsdt(wallet.availableBalance)} USDT
                </span>
                <span className="text-slate-300">|</span>
                <span className="text-slate-500">{t("locked")}</span>
                <span className="font-semibold text-blue-600">
                  {isLoading ? "…" : formatUsdt(wallet.lockedBalance)} USDT
                </span>
              </div>
            ) : null}

            <nav className="flex items-center gap-1 lg:hidden">
              {NAV_ITEMS.map((item) => {
                const active = pathname === item.href;
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={`rounded-lg px-2.5 py-1 text-xs font-medium transition ${
                      active ? "bg-brand-50 text-brand-600" : "text-slate-600 hover:text-slate-900"
                    }`}
                  >
                    {t(item.key)}
                  </Link>
                );
              })}
              <button
                type="button"
                onClick={() => setAboutOpen(true)}
                className="rounded-lg border border-blue-200/80 bg-slate-900 px-2.5 py-1 text-xs font-semibold text-blue-100"
              >
                {t("about")}
              </button>
            </nav>
            <LanguageSwitcher />
            <button
              type="button"
              onClick={handleLogout}
              className="rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-600 transition hover:border-brand-200 hover:text-brand-600"
            >
              {t("logout")}
            </button>
          </div>
        </div>
      </header>

      <AboutPlatformModal open={aboutOpen} onClose={() => setAboutOpen(false)} />
    </>
  );
}
