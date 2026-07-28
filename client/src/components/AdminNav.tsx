"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";
import { clearAuthSession, getStoredUser } from "@/lib/auth";
import { ADMIN_ROUTES } from "@/lib/adminPaths";

const NAV_ITEMS = [
  { href: ADMIN_ROUTES.home, key: "overview" as const, exact: true },
  { href: ADMIN_ROUTES.trades, key: "trades" as const, exact: false },
  { href: ADMIN_ROUTES.withdrawals, key: "withdrawals" as const, exact: false },
  { href: ADMIN_ROUTES.deposits, key: "deposits" as const, exact: false },
  { href: ADMIN_ROUTES.users, key: "users" as const, exact: false },
  { href: ADMIN_ROUTES.packages, key: "packages" as const, exact: false },
  { href: ADMIN_ROUTES.referrals, key: "referrals" as const, exact: false },
];

export function AdminNav() {
  const pathname = usePathname();
  const router = useRouter();
  const t = useTranslations("admin.nav");
  const user = getStoredUser();

  function handleLogout() {
    clearAuthSession();
    router.replace(ADMIN_ROUTES.login);
  }

  return (
    <header className="relative z-10 border-b border-white/10 bg-[#071018]/80 backdrop-blur-md">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-4 px-4 py-4 sm:px-6">
        <div className="flex items-center gap-6">
          <Link href={ADMIN_ROUTES.home} className="flex items-center gap-2">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-cyan-400 to-brand-500 text-lg font-bold text-[#041016] shadow-[0_0_28px_rgba(34,211,238,0.3)]">
              A
            </span>
            <div>
              <p className="text-sm font-semibold text-white">{t("brand")}</p>
              <p className="text-[11px] text-slate-400">{t("subtitle")}</p>
            </div>
          </Link>

          <nav className="hidden items-center gap-1 sm:flex">
            {NAV_ITEMS.map((item) => {
              const active = item.exact ? pathname === item.href : pathname.startsWith(item.href);
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
          </nav>
        </div>

        <div className="flex items-center gap-3">
          <nav className="flex items-center gap-1 sm:hidden">
            {NAV_ITEMS.map((item) => {
              const active = item.exact ? pathname === item.href : pathname.startsWith(item.href);
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
          </nav>
          {user?.email ? (
            <span className="hidden text-xs text-slate-400 md:inline">{user.email}</span>
          ) : null}
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
  );
}
