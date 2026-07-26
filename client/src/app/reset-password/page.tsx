"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { Suspense, useMemo, useState } from "react";
import { AuthChromeHeader } from "@/components/AuthChromeHeader";
import { TrustComplianceBlock } from "@/components/TrustCompliance";
import { getApiErrorMessage } from "@/lib/api";
import { resetPassword } from "@/lib/auth";

const STRONG_PASSWORD_REGEX = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9]).{8,}$/;

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={null}>
      <ResetPasswordForm />
    </Suspense>
  );
}

function ResetPasswordForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const t = useTranslations("resetPassword");
  const tCommon = useTranslations("common");

  const token = useMemo(() => searchParams.get("token")?.trim() ?? "", [searchParams]);

  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isPasswordVisible, setIsPasswordVisible] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isSuccess, setIsSuccess] = useState(false);

  const isPasswordStrongEnough = password.length === 0 || STRONG_PASSWORD_REGEX.test(password);
  const passwordsMatch = confirmPassword.length === 0 || password === confirmPassword;

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setErrorMessage(null);

    if (!STRONG_PASSWORD_REGEX.test(password)) {
      setErrorMessage(t("errors.passwordWeak"));
      return;
    }
    if (password !== confirmPassword) {
      setErrorMessage(t("errors.passwordMismatch"));
      return;
    }

    setIsSubmitting(true);
    try {
      await resetPassword({ token, newPassword: password });
      setIsSuccess(true);
      window.setTimeout(() => router.push("/login"), 1800);
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
            {!token ? (
              <>
                <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-brand-500 sm:text-xs">
                  {t("eyebrow")}
                </p>
                <h1 className="mt-2.5 text-2xl font-bold tracking-tight text-slate-900 sm:text-[2rem]">
                  {t("missingTokenTitle")}
                </h1>
                <p className="mt-2.5 text-[15px] leading-relaxed text-slate-600">{t("missingTokenBody")}</p>
                <Link
                  href="/forgot-password"
                  className="mt-8 inline-flex w-full items-center justify-center rounded-xl bg-gradient-to-r from-brand-500 to-brand-600 px-4 py-3 text-sm font-semibold text-white shadow-lg shadow-brand-500/25 transition hover:brightness-110"
                >
                  {t("requestNewLink")}
                </Link>
              </>
            ) : isSuccess ? (
              <>
                <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-brand-500 sm:text-xs">
                  {t("eyebrow")}
                </p>
                <h1 className="mt-2.5 text-2xl font-bold tracking-tight text-slate-900 sm:text-[2rem]">
                  {t("successTitle")}
                </h1>
                <p className="mt-2.5 text-[15px] leading-relaxed text-slate-600">{t("successBody")}</p>
                <Link
                  href="/login"
                  className="mt-8 inline-flex w-full items-center justify-center rounded-xl bg-gradient-to-r from-brand-500 to-brand-600 px-4 py-3 text-sm font-semibold text-white shadow-lg shadow-brand-500/25 transition hover:brightness-110"
                >
                  {t("goToLogin")}
                </Link>
              </>
            ) : (
              <>
                <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-brand-500 sm:text-xs">
                  {t("eyebrow")}
                </p>
                <h1 className="mt-2.5 text-2xl font-bold tracking-tight text-slate-900 sm:text-[2rem]">
                  {t("title")}
                </h1>
                <p className="mt-2.5 text-[15px] leading-relaxed text-slate-600">{t("subtitle")}</p>

                <form onSubmit={handleSubmit} className="mt-8 space-y-5">
                  <label className="block">
                    <span className="mb-1.5 block text-sm font-medium text-slate-700">
                      {t("passwordLabel")}
                    </span>
                    <div className="relative">
                      <input
                        type={isPasswordVisible ? "text" : "password"}
                        required
                        autoComplete="new-password"
                        value={password}
                        onChange={(event) => setPassword(event.target.value)}
                        placeholder={t("passwordPlaceholder")}
                        className="input-surface pe-11"
                        dir="ltr"
                      />
                      <button
                        type="button"
                        onClick={() => setIsPasswordVisible((visible) => !visible)}
                        aria-label={isPasswordVisible ? t("hidePassword") : t("showPassword")}
                        className="absolute inset-y-0 end-2 flex items-center px-2 text-slate-500 transition hover:text-slate-700"
                      >
                        {isPasswordVisible ? <EyeOffIcon /> : <EyeIcon />}
                      </button>
                    </div>
                    {!isPasswordStrongEnough ? (
                      <span role="alert" className="mt-1.5 block text-xs font-medium text-rose-600">
                        {t("errors.passwordWeak")}
                      </span>
                    ) : null}
                  </label>

                  <label className="block">
                    <span className="mb-1.5 block text-sm font-medium text-slate-700">
                      {t("confirmLabel")}
                    </span>
                    <input
                      type={isPasswordVisible ? "text" : "password"}
                      required
                      autoComplete="new-password"
                      value={confirmPassword}
                      onChange={(event) => setConfirmPassword(event.target.value)}
                      placeholder={t("confirmPlaceholder")}
                      className="input-surface"
                      dir="ltr"
                    />
                    {!passwordsMatch ? (
                      <span role="alert" className="mt-1.5 block text-xs font-medium text-rose-600">
                        {t("errors.passwordMismatch")}
                      </span>
                    ) : null}
                  </label>

                  {errorMessage ? (
                    <div className="rounded-xl border border-rose-200 bg-rose-50 px-3.5 py-2.5 text-sm text-rose-700">
                      {errorMessage}
                    </div>
                  ) : null}

                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="w-full rounded-xl bg-gradient-to-r from-brand-500 to-brand-600 px-4 py-3 text-sm font-semibold text-white shadow-lg shadow-brand-500/25 transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-50 disabled:shadow-none"
                  >
                    {isSubmitting ? t("submitting") : t("submit")}
                  </button>
                </form>
              </>
            )}
          </div>

          <div className="mt-6">
            <TrustComplianceBlock compact />
          </div>

          <p className="mt-6 flex items-center justify-center gap-2 text-center text-xs text-slate-500">
            <span aria-hidden>🔒</span>
            {tCommon("securedBy")}
          </p>
        </div>
      </main>
    </div>
  );
}

function EyeIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" className="h-5 w-5">
      <path
        d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7Z"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx="12" cy="12" r="3" stroke="currentColor" strokeWidth="1.5" />
    </svg>
  );
}

function EyeOffIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" className="h-5 w-5">
      <path
        d="M3 3l18 18M10.6 5.2A10.8 10.8 0 0 1 12 5c6.5 0 10 7 10 7a17.6 17.6 0 0 1-3.2 4.2M6.6 6.6A17.9 17.9 0 0 0 2 12s3.5 7 10 7c1.3 0 2.5-.2 3.6-.6M9.9 9.9a3 3 0 0 0 4.2 4.2"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
