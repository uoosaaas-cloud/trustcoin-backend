"use client";

import Link from "next/link";
import { useTranslations } from "next-intl";
import { AuthChromeHeader } from "@/components/AuthChromeHeader";
import { TrustComplianceBlock } from "@/components/TrustCompliance";

const SUPPORT_EMAIL = "support@trustcoin.cc";

export default function AccountPendingPage() {
  const t = useTranslations("accountPending");

  return (
    <div className="page-shell flex flex-col">
      <AuthChromeHeader brandHref="/" />

      <main className="relative z-10 flex flex-1 items-center justify-center px-4 py-10 sm:px-6">
        <div className="w-full max-w-lg">
          <div className="card-surface animate-fade-in-up rounded-[1.5rem] p-7 sm:p-9">
            <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-amber-200 sm:text-xs">
              {t("eyebrow")}
            </p>
            <h1 className="mt-2.5 text-2xl font-bold tracking-tight text-white sm:text-[2rem]">
              {t("title")}
            </h1>
            <p className="mt-3 text-[15px] leading-relaxed text-slate-300">{t("body")}</p>
            <p className="mt-3 text-[14px] leading-relaxed text-slate-400">{t("timeline")}</p>

            <a
              href={`mailto:${SUPPORT_EMAIL}`}
              className="mt-6 flex items-center justify-between rounded-xl border border-cyan-300/25 bg-cyan-400/10 px-4 py-3 text-sm text-cyan-100 transition hover:bg-cyan-400/15"
            >
              <span>{t("supportLabel")}</span>
              <span dir="ltr" className="font-semibold">
                {SUPPORT_EMAIL}
              </span>
            </a>

            <Link
              href="/login"
              className="mt-5 inline-flex w-full items-center justify-center rounded-xl bg-gradient-to-r from-cyan-300 to-cyan-200 py-3 text-sm font-bold text-[#041016]"
            >
              {t("backToLogin")}
            </Link>
          </div>

          <div className="mt-8">
            <TrustComplianceBlock compact />
          </div>
        </div>
      </main>
    </div>
  );
}
