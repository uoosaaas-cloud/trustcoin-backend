"use client";

import Link from "next/link";
import { useTranslations } from "next-intl";
import { useEffect, useState } from "react";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";
import { TrustCoinLogo } from "@/components/TrustCoinLogo";
import { getStoredAuthToken } from "@/lib/api";

export default function LandingPage() {
  const t = useTranslations("landing");
  const tBrand = useTranslations("brand");
  const [authed, setAuthed] = useState(false);

  useEffect(() => {
    setAuthed(Boolean(getStoredAuthToken()));
  }, []);

  return (
    <main className="relative min-h-screen overflow-hidden bg-[#071018] text-slate-100">
      {/* Atmospheric full-bleed plane */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{
          backgroundImage:
            "radial-gradient(ellipse 90% 70% at 70% -10%, rgba(8,145,178,0.35), transparent 55%), radial-gradient(ellipse 60% 50% at 0% 100%, rgba(239,68,68,0.18), transparent 50%), linear-gradient(165deg, #05070f 0%, #0b1224 45%, #071018 100%)",
        }}
      />
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-[0.35]"
        style={{
          backgroundImage:
            "linear-gradient(rgba(148,163,184,0.07) 1px, transparent 1px), linear-gradient(90deg, rgba(148,163,184,0.07) 1px, transparent 1px)",
          backgroundSize: "56px 56px",
          maskImage: "radial-gradient(ellipse at center, black 20%, transparent 75%)",
        }}
      />

      <header className="relative z-10 mx-auto flex max-w-6xl items-center justify-between px-5 py-6 sm:px-8">
        <TrustCoinLogo href="/" name={tBrand("name")} size="lg" />
        <div className="flex items-center gap-3">
          <LanguageSwitcher />
          {authed ? (
            <Link
              href="/dashboard/"
              className="rounded-xl bg-white px-4 py-2 text-sm font-semibold text-slate-900 transition hover:bg-cyan-50"
            >
              {t("goDashboard")}
            </Link>
          ) : null}
        </div>
      </header>

      {/* Hero — brand first, one headline, one support, CTA group */}
      <section className="relative z-10 mx-auto flex min-h-[78vh] max-w-6xl flex-col justify-center px-5 pb-16 pt-8 sm:px-8">
        <p className="animate-fade-in-up mb-4 text-[11px] font-bold uppercase tracking-[0.28em] text-cyan-300/90">
          {tBrand("name")}
        </p>
        <h1 className="animate-fade-in-up max-w-3xl text-4xl font-extrabold leading-[1.1] tracking-tight text-white sm:text-5xl md:text-6xl">
          {t("heroTitle")}
        </h1>
        <p className="animate-fade-in-up mt-5 max-w-xl text-base leading-relaxed text-slate-300 sm:text-lg">
          {t("heroSubtitle")}
        </p>

        <div className="animate-fade-in-up mt-10 flex flex-wrap items-center gap-3">
          <Link
            href="/login/"
            className="inline-flex items-center justify-center rounded-2xl bg-gradient-to-r from-cyan-400 to-cyan-300 px-7 py-3.5 text-sm font-bold text-[#041016] shadow-[0_12px_40px_rgba(34,211,238,0.28)] transition hover:brightness-105"
          >
            {t("login")}
          </Link>
          <Link
            href="/register/"
            className="inline-flex items-center justify-center rounded-2xl border border-white/20 bg-white/5 px-7 py-3.5 text-sm font-semibold text-white backdrop-blur transition hover:border-cyan-300/50 hover:bg-white/10"
          >
            {t("register")}
          </Link>
        </div>

        <div
          aria-hidden
          className="pointer-events-none absolute bottom-8 end-4 hidden h-48 w-48 rounded-full bg-cyan-400/20 blur-3xl md:block"
          style={{ animation: "pulse 6s ease-in-out infinite" }}
        />
      </section>

      {/* Profitability */}
      <section className="relative z-10 border-t border-white/10 bg-[#0a1220]/80">
        <div className="mx-auto max-w-6xl px-5 py-20 sm:px-8">
          <h2 className="text-2xl font-bold tracking-tight text-white sm:text-3xl">{t("profitTitle")}</h2>
          <p className="mt-3 max-w-2xl text-slate-400">{t("profitBody")}</p>
          <ul className="mt-10 grid gap-6 sm:grid-cols-3">
            {(["daily", "packages", "referrals"] as const).map((key) => (
              <li key={key} className="border-s-2 border-cyan-400/60 ps-4">
                <p className="text-sm font-semibold text-cyan-300">{t(`profitPoints.${key}.label`)}</p>
                <p className="mt-2 text-sm leading-relaxed text-slate-400">{t(`profitPoints.${key}.body`)}</p>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* Security */}
      <section className="relative z-10 border-t border-white/10">
        <div className="mx-auto max-w-6xl px-5 py-20 sm:px-8">
          <h2 className="text-2xl font-bold tracking-tight text-white sm:text-3xl">{t("securityTitle")}</h2>
          <p className="mt-3 max-w-2xl text-slate-400">{t("securityBody")}</p>
          <ul className="mt-10 grid gap-6 sm:grid-cols-3">
            {(["otp", "kyc", "wallets"] as const).map((key) => (
              <li key={key}>
                <p className="text-sm font-semibold text-white">{t(`securityPoints.${key}.label`)}</p>
                <p className="mt-2 text-sm leading-relaxed text-slate-400">{t(`securityPoints.${key}.body`)}</p>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* Details */}
      <section className="relative z-10 border-t border-white/10 bg-[#080e1a]">
        <div className="mx-auto max-w-6xl px-5 py-20 sm:px-8">
          <h2 className="text-2xl font-bold tracking-tight text-white sm:text-3xl">{t("detailsTitle")}</h2>
          <p className="mt-3 max-w-2xl text-slate-400">{t("detailsBody")}</p>
          <div className="mt-12 flex flex-wrap gap-3">
            <Link
              href="/login/"
              className="rounded-2xl bg-white px-6 py-3 text-sm font-bold text-slate-900 transition hover:bg-cyan-50"
            >
              {t("login")}
            </Link>
            <Link
              href="/register/"
              className="rounded-2xl border border-white/25 px-6 py-3 text-sm font-semibold text-white transition hover:border-cyan-300/60"
            >
              {t("register")}
            </Link>
          </div>
        </div>
      </section>

      <footer className="relative z-10 border-t border-white/10 px-5 py-8 text-center text-xs text-slate-500 sm:px-8">
        <p>
          © {new Date().getFullYear()} {tBrand("name")} · {tBrand("tagline")}
        </p>
        <p className="mt-2">
          <a
            href="mailto:support@trustcoin.cc"
            className="font-medium text-cyan-300/90 transition hover:text-cyan-200"
          >
            support@trustcoin.cc
          </a>
        </p>
      </footer>
    </main>
  );
}
