"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";
import { clearAuthSession, getStoredUser } from "@/lib/auth";
import { ADMIN_ROUTES } from "@/lib/adminPaths";

const NAV_ITEMS = [
  { href: ADMIN_ROUTES.home, key: "overview" as const, exact: true },
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
    <header className="relative z-10 border-b border-slate-200/80 bg-white/85 backdrop-blur-md shadow-sm">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-4 px-4 py-4 sm:px-6">
        <div className="flex items-center gap-6">
          <Link href={ADMIN_ROUTES.home} className="flex items-center gap-2">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-brand-500 to-gold-500 text-lg font-bold text-white shadow-md shadow-brand-500/20">
              A
            </span>
            <div>
              <p className="text-sm font-semibold text-slate-900">{t("brand")}</p>
              <p className="text-[11px] text-slate-500">{t("subtitle")}</p>
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
                      ? "bg-brand-50 text-brand-600"
                      : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
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
                    active ? "bg-brand-50 text-brand-600" : "text-slate-600 hover:text-slate-900"
                  }`}
                >
                  {t(item.key)}
                </Link>
              );
            })}
          </nav>
          {user?.email ? (
            <span className="hidden text-xs text-slate-500 md:inline">{user.email}</span>
          ) : null}
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
  );
}
