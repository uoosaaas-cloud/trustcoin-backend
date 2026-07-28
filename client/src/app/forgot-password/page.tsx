"use client";

import Link from "next/link";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { AuthChromeHeader } from "@/components/AuthChromeHeader";
import { TrustComplianceBlock } from "@/components/TrustCompliance";
import { getApiErrorMessage } from "@/lib/api";
import { forgotPassword } from "@/lib/auth";

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default function ForgotPasswordPage() {
  const t = useTranslations("forgotPassword");
  const tCommon = useTranslations("common");

  const [email, setEmail] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isSuccess, setIsSuccess] = useState(false);
  const [devResetLink, setDevResetLink] = useState<string | null>(null);

  const isEmailValid = email.length === 0 || EMAIL_REGEX.test(email.trim());

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setErrorMessage(null);

    const trimmedEmail = email.trim().toLowerCase();
    if (!EMAIL_REGEX.test(trimmedEmail)) {
      setErrorMessage(t("errors.emailRequired"));
      return;
    }

    setIsSubmitting(true);
    try {
      const response = await forgotPassword({ email: trimmedEmail });
      setDevResetLink(response.data.resetLink ?? null);
      setIsSuccess(true);
    } catch (error) {
      setErrorMessage(getApiErrorMessage(error, t("errors.generic")));
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="page-shell flex flex-col">
      <AuthChromeHeader brandHref="/" />

      <main className="relative z-10 flex flex-1 items-center justify-center px-4 py-10 sm:px-6">
        <div className="w-full max-w-lg">
          <div className="card-surface animate-fade-in-up rounded-[1.5rem] p-7 sm:p-9">
            <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-cyan-300 sm:text-xs">
              {t("eyebrow")}
            </p>
            <h1 className="mt-2.5 text-2xl font-bold tracking-tight text-white sm:text-[2rem] sm:leading-tight">
              {isSuccess ? t("successTitle") : t("title")}
            </h1>
            <p className="mt-2.5 text-[15px] leading-relaxed text-slate-400">
              {isSuccess ? t("successBody") : t("subtitle")}
            </p>

            {isSuccess ? (
              <div className="mt-8 space-y-4">
                {devResetLink ? (
                  <div className="rounded-xl border border-amber-200 bg-amber-50 px-3.5 py-3 text-xs text-amber-900">
                    <p className="font-medium">{t("devLinkNotice")}</p>
                    <Link
                      href={devResetLink}
                      className="mt-2 block break-all font-semibold text-cyan-300 underline"
                    >
                      {devResetLink}
                    </Link>
                  </div>
                ) : null}
                <Link
                  href="/login"
                  className="inline-flex w-full items-center justify-center rounded-xl bg-gradient-to-r from-cyan-400 to-cyan-300 px-4 py-3 text-sm font-bold text-[#041016] shadow-[0_12px_40px_rgba(34,211,238,0.22)] transition hover:brightness-110"
                >
                  {t("backToLogin")}
                </Link>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="mt-8 space-y-5">
                <label className="block">
                  <span className="mb-1.5 block text-sm font-medium text-slate-300">{t("emailLabel")}</span>
                  <input
                    type="email"
                    required
                    autoComplete="email"
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                    placeholder={t("emailPlaceholder")}
                    className={`input-surface ${!isEmailValid ? "border-rose-300 focus:border-rose-400 focus:ring-rose-400/20" : ""}`}
                    dir="ltr"
                  />
                  {!isEmailValid ? (
                    <span
                      role="alert"
                      className="mt-1.5 flex items-center gap-1 text-xs font-medium text-rose-300"
                    >
                      {t("errors.emailRequired")}
                    </span>
                  ) : null}
                </label>

                {errorMessage ? (
                  <div className="rounded-xl border border-rose-400/30 bg-rose-500/10 px-3.5 py-2.5 text-sm text-rose-300">
                    {errorMessage}
                  </div>
                ) : null}

                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="w-full rounded-xl bg-gradient-to-r from-cyan-400 to-cyan-300 px-4 py-3 text-sm font-bold text-[#041016] shadow-[0_12px_40px_rgba(34,211,238,0.22)] transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-50 disabled:shadow-none"
                >
                  {isSubmitting ? t("submitting") : t("submit")}
                </button>

                <p className="text-center text-sm text-slate-400">
                  <Link href="/login" className="font-semibold text-cyan-300 hover:text-cyan-200">
                    {t("backToLogin")}
                  </Link>
                </p>
              </form>
            )}
          </div>

          <div className="mt-6">
            <TrustComplianceBlock compact />
          </div>

          <p className="mt-6 flex items-center justify-center gap-2 text-center text-xs text-slate-400">
            <span aria-hidden>🔒</span>
            {tCommon("securedBy")}
          </p>
        </div>
      </main>
    </div>
  );
}
