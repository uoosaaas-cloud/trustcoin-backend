"use client";

import { useLocale, useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { locales, persistLocaleCookie, type Locale } from "@/i18n/config";

export function LanguageSwitcher() {
  const locale = useLocale() as Locale;
  const t = useTranslations("languageSwitcher");
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [open, setOpen] = useState(false);

  function selectLocale(next: Locale) {
    if (next === locale) {
      setOpen(false);
      return;
    }

    persistLocaleCookie(next);
    setOpen(false);

    startTransition(() => {
      router.refresh();
    });
  }

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        aria-label={t("label")}
        disabled={isPending}
        className="flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3.5 py-1.5 text-sm font-medium text-slate-700 shadow-sm transition hover:border-brand-200 hover:text-brand-600 disabled:opacity-60"
      >
        <span aria-hidden className="text-brand-500">
          🌐
        </span>
        <span>{locale === "ar" ? t("ar") : t("en")}</span>
        <svg
          viewBox="0 0 20 20"
          fill="none"
          className={`h-3.5 w-3.5 text-slate-400 transition-transform ${open ? "rotate-180" : ""}`}
        >
          <path d="M5 7.5 10 12.5 15 7.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>

      {open && (
        <div className="absolute end-0 z-20 mt-2 w-40 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xl shadow-slate-200/60">
          {locales.map((code) => (
            <button
              key={code}
              type="button"
              onClick={() => selectLocale(code)}
              className={`flex w-full items-center justify-between px-4 py-2.5 text-start text-sm transition ${
                code === locale
                  ? "bg-brand-50 text-brand-600"
                  : "text-slate-700 hover:bg-slate-50"
              }`}
            >
              {code === "ar" ? t("ar") : t("en")}
              {code === locale && <span aria-hidden>✓</span>}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
