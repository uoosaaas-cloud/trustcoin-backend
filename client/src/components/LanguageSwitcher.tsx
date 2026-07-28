"use client";

import { useLocale, useTranslations } from "next-intl";
import { useTransition } from "react";
import { persistLocaleCookie, type Locale } from "@/i18n/config";

/**
 * Two-button language toggle (EN | AR) — replaces the old dropdown/pill switcher.
 */
export function LanguageSwitcher() {
  const locale = useLocale() as Locale;
  const t = useTranslations("languageSwitcher");
  const [isPending, startTransition] = useTransition();

  function selectLocale(next: Locale) {
    if (next === locale || isPending) return;
    persistLocaleCookie(next);
    startTransition(() => {
      window.location.reload();
    });
  }

  const btnBase =
    "min-w-[2.75rem] rounded-lg px-2.5 py-1.5 text-xs font-semibold tracking-wide transition disabled:opacity-60";

  return (
    <div
      role="group"
      aria-label={t("label")}
      className="inline-flex items-center gap-0.5 rounded-xl border border-slate-200 bg-white p-0.5 shadow-sm"
    >
      <button
        type="button"
        onClick={() => selectLocale("en")}
        disabled={isPending}
        aria-pressed={locale === "en"}
        className={`${btnBase} ${
          locale === "en"
            ? "bg-slate-900 text-white shadow-sm"
            : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
        }`}
      >
        EN
      </button>
      <button
        type="button"
        onClick={() => selectLocale("ar")}
        disabled={isPending}
        aria-pressed={locale === "ar"}
        className={`${btnBase} ${
          locale === "ar"
            ? "bg-slate-900 text-white shadow-sm"
            : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
        }`}
      >
        ع
      </button>
    </div>
  );
}
