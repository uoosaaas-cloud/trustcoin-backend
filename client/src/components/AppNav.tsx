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

const SUPPORT_EMAIL = "support@trustcoin.cc";

export function AppNav() {
  const pathname = usePathname();
  const router = useRouter();
  const t = useTranslations("nav");
  const { wallet, isLoading, refreshWallet } = useWallet();
  const [aboutOpen, setAboutOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    if (getStoredAuthToken()) {
      void refreshWallet({ silent: true });
    }
  }, [pathname, refreshWallet]);

  useEffect(() => {
    setMenuOpen(false);
  }, [pathname]);

  function handleLogout() {
    clearAuthSession();
    router.replace("/login");
  }

  const showWallet = getStoredAuthToken() && wallet;

  return (
    <>
      <header className="relative z-20 border-b border-white/14 bg-[#071018]/85 px-4 py-4 backdrop-blur-md sm:px-8">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-4">
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
                        ? "bg-cyan-400/12 text-cyan-200"
                        : "text-slate-400 hover:bg-white/[0.08] hover:text-white"
                    }`}
                  >
                    {t(item.key)}
                  </Link>
                );
              })}
              <button
                type="button"
                onClick={() => setAboutOpen(true)}
                className="rounded-xl border border-white/14 bg-white/[0.06] px-3 py-1.5 text-sm font-semibold text-cyan-100 transition hover:border-cyan-300/35 hover:bg-white/[0.1]"
              >
                {t("about")}
              </button>
            </nav>
          </div>

          <div className="flex items-center gap-2 sm:gap-3">
            {showWallet ? (
              <div className="hidden items-center gap-2 rounded-2xl border border-white/14 bg-white/[0.08] px-3 py-1.5 text-xs sm:flex">
                <span className="text-slate-400">{t("available")}</span>
                <span className="font-semibold text-cyan-200">
                  {isLoading ? "…" : formatUsdt(wallet.availableBalance)} USDT
                </span>
                <span className="text-white/20">|</span>
                <span className="text-slate-400">{t("locked")}</span>
                <span className="font-semibold text-slate-200">
                  {isLoading ? "…" : formatUsdt(wallet.lockedBalance)} USDT
                </span>
              </div>
            ) : null}

            <LanguageSwitcher />

            <button
              type="button"
              onClick={handleLogout}
              className="hidden rounded-xl border border-white/14 bg-white/[0.06] px-3 py-1.5 text-xs font-medium text-slate-300 transition hover:border-cyan-300/35 hover:text-cyan-200 sm:inline-flex"
            >
              {t("logout")}
            </button>

            <button
              type="button"
              aria-expanded={menuOpen}
              aria-label={menuOpen ? t("closeMenu") : t("openMenu")}
              onClick={() => setMenuOpen((open) => !open)}
              className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-white/14 bg-white/[0.06] text-white lg:hidden"
            >
              <svg viewBox="0 0 24 24" fill="none" className="h-5 w-5" aria-hidden>
                {menuOpen ? (
                  <path d="M6 6l12 12M18 6L6 18" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" />
                ) : (
                  <path d="M4 7h16M4 12h16M4 17h16" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" />
                )}
              </svg>
            </button>
          </div>
        </div>

        {menuOpen ? (
          <div className="mt-4 rounded-2xl border border-white/14 bg-[#0a1620]/95 p-3 lg:hidden">
            {showWallet ? (
              <div className="mb-3 flex items-center justify-between rounded-xl border border-white/10 bg-white/[0.05] px-3 py-2 text-xs sm:hidden">
                <span className="text-slate-400">{t("available")}</span>
                <span className="font-semibold text-cyan-200">
                  {isLoading ? "…" : formatUsdt(wallet.availableBalance)} USDT
                </span>
              </div>
            ) : null}
            <nav className="grid gap-1">
              {NAV_ITEMS.map((item) => {
                const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={`rounded-xl px-3 py-2.5 text-sm font-medium transition ${
                      active
                        ? "bg-cyan-400/12 text-cyan-200"
                        : "text-slate-300 hover:bg-white/[0.08] hover:text-white"
                    }`}
                  >
                    {t(item.key)}
                  </Link>
                );
              })}
              <button
                type="button"
                onClick={() => {
                  setMenuOpen(false);
                  setAboutOpen(true);
                }}
                className="rounded-xl px-3 py-2.5 text-start text-sm font-semibold text-cyan-100 hover:bg-white/[0.08]"
              >
                {t("about")}
              </button>
              <a
                href={`mailto:${SUPPORT_EMAIL}`}
                className="rounded-xl px-3 py-2.5 text-sm font-medium text-slate-300 hover:bg-white/[0.08] hover:text-white"
              >
                {t("support")}
              </a>
              <button
                type="button"
                onClick={handleLogout}
                className="rounded-xl px-3 py-2.5 text-start text-sm font-medium text-rose-200 hover:bg-rose-500/10 sm:hidden"
              >
                {t("logout")}
              </button>
            </nav>
          </div>
        ) : null}
      </header>

      <AboutPlatformModal open={aboutOpen} onClose={() => setAboutOpen(false)} />
    </>
  );
}
