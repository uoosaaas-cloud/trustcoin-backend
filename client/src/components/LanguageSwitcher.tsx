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
      className="inline-flex items-center gap-0.5 rounded-xl border border-white/15 bg-white/5 p-0.5"
    >
      <button
        type="button"
        onClick={() => selectLocale("en")}
        disabled={isPending}
        aria-pressed={locale === "en"}
        className={`${btnBase} ${
          locale === "en"
            ? "bg-cyan-400 text-[#041016] shadow-[0_0_16px_rgba(34,211,238,0.25)]"
            : "text-slate-400 hover:bg-white/5 hover:text-white"
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
            ? "bg-cyan-400 text-[#041016] shadow-[0_0_16px_rgba(34,211,238,0.25)]"
            : "text-slate-400 hover:bg-white/5 hover:text-white"
        }`}
      >
        ع
      </button>
    </div>
  );
}
