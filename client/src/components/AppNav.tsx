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
  { href: "/trades", key: "trades" as const },
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

  return (
    <>
      <header className="relative z-10 border-b border-white/10 bg-[#071018]/80 px-6 py-5 backdrop-blur-md sm:px-10">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-6">
            <Link href="/dashboard" className="flex items-center gap-2">
              <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-cyan-400 to-brand-500 text-lg font-bold text-[#041016] shadow-[0_0_28px_rgba(34,211,238,0.3)]">
                T
              </span>
              <span className="text-lg font-semibold tracking-tight text-white">TrustCoin</span>
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
                        ? "bg-cyan-400/15 text-cyan-300"
                        : "text-slate-400 hover:bg-white/5 hover:text-white"
                    }`}
                  >
                    {t(item.key)}
                  </Link>
                );
              })}
              <button
                type="button"
                onClick={() => setAboutOpen(true)}
                className="rounded-xl border border-white/15 bg-white/5 px-3 py-1.5 text-sm font-semibold text-cyan-100 transition hover:border-cyan-300/40 hover:bg-white/10"
              >
                {t("about")}
              </button>
            </nav>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            {showWallet ? (
              <div className="hidden items-center gap-2 rounded-2xl border border-white/10 bg-white/5 px-3 py-1.5 text-xs sm:flex">
                <span className="text-slate-400">{t("available")}</span>
                <span className="font-semibold text-emerald-400">
                  {isLoading ? "…" : formatUsdt(wallet.availableBalance)} USDT
                </span>
                <span className="text-white/20">|</span>
                <span className="text-slate-400">{t("locked")}</span>
                <span className="font-semibold text-cyan-300">
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
                      active ? "bg-cyan-400/15 text-cyan-300" : "text-slate-400 hover:text-white"
                    }`}
                  >
                    {t(item.key)}
                  </Link>
                );
              })}
              <button
                type="button"
                onClick={() => setAboutOpen(true)}
                className="rounded-lg border border-white/15 bg-white/5 px-2.5 py-1 text-xs font-semibold text-cyan-100"
              >
                {t("about")}
              </button>
            </nav>
            <LanguageSwitcher />
            <button
              type="button"
              onClick={handleLogout}
              className="rounded-xl border border-white/15 bg-white/5 px-3 py-1.5 text-xs font-medium text-slate-300 transition hover:border-cyan-300/40 hover:text-cyan-200"
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
