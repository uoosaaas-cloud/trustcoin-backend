"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useEffect, useState } from "react";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";
import { getApiErrorMessage, getStoredAuthToken } from "@/lib/api";
import { loginAdmin, verifyAdminLoginOtp } from "@/lib/admin";
import { ADMIN_ROUTES } from "@/lib/adminPaths";
import { getStoredUser } from "@/lib/auth";

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const OTP_REGEX = /^\d{6}$/;

type Step = "credentials" | "otp";

export default function AdminLoginPage() {
  const router = useRouter();
  const t = useTranslations("admin.login");
  const tCommon = useTranslations("common");

  const [step, setStep] = useState<Step>("credentials");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [otpCode, setOtpCode] = useState("");
  const [devOtpHint, setDevOtpHint] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    const token = getStoredAuthToken();
    const user = getStoredUser();
    if (token && user?.role === "ADMIN") {
      router.replace(ADMIN_ROUTES.home);
    }
  }, [router]);

  async function handleCredentialsSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setErrorMessage(null);

    if (!EMAIL_REGEX.test(email.trim())) {
      setErrorMessage(t("errors.emailRequired"));
      return;
    }
    if (!password) {
      setErrorMessage(t("errors.passwordRequired"));
      return;
    }

    setIsSubmitting(true);
    try {
      const response = await loginAdmin({ email: email.trim().toLowerCase(), password });
      const challenge = response.data;

      if (!challenge?.requiresOtp) {
        setErrorMessage(t("errors.generic"));
        return;
      }

      setEmail(challenge.email);
      setPassword("");
      setOtpCode(challenge.otpCode ?? "");
      setDevOtpHint(challenge.otpCode ?? null);
      setStep("otp");
    } catch (error) {
      setErrorMessage(getApiErrorMessage(error, t("errors.generic")));
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleOtpSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setErrorMessage(null);

    const code = otpCode.trim();
    if (!OTP_REGEX.test(code)) {
      setErrorMessage(t("errors.otpRequired"));
      return;
    }

    setIsSubmitting(true);
    try {
      await verifyAdminLoginOtp({ email: email.trim().toLowerCase(), code });
      router.replace(ADMIN_ROUTES.home);
    } catch (error) {
      setErrorMessage(getApiErrorMessage(error, t("errors.otpInvalid")));
    } finally {
      setIsSubmitting(false);
    }
  }

  function handleBackToCredentials() {
    setStep("credentials");
    setOtpCode("");
    setDevOtpHint(null);
    setErrorMessage(null);
  }

  return (
    <div className="page-shell flex flex-col">
      <header className="relative z-10 flex items-center justify-between px-6 py-6 sm:px-10">
        <Link href="/" className="flex items-center gap-2">
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-cyan-400 to-brand-500 text-lg font-bold text-white shadow-md">
            A
          </span>
          <span className="text-lg font-semibold text-white">TrustCoin Admin</span>
        </Link>
        <LanguageSwitcher />
      </header>

      <main className="relative z-10 mx-auto flex w-full max-w-md flex-1 flex-col justify-center px-4 pb-16">
        <p className="text-xs font-semibold uppercase tracking-widest text-cyan-300">
          {step === "otp" ? t("otpEyebrow") : t("eyebrow")}
        </p>
        <h1 className="mt-2 text-3xl font-bold text-white">
          {step === "otp" ? t("otpTitle") : t("title")}
        </h1>
        <p className="mt-2 text-sm text-slate-400">
          {step === "otp" ? t("otpSubtitle", { email }) : t("subtitle")}
        </p>

        {errorMessage ? (
          <div className="mt-6 rounded-2xl border border-rose-400/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-300">
            {errorMessage}
          </div>
        ) : null}

        {step === "credentials" ? (
          <form onSubmit={handleCredentialsSubmit} className="card-surface mt-6 space-y-4 rounded-3xl p-6">
            <div>
              <label htmlFor="admin-email" className="block text-sm font-medium text-slate-300">
                {t("emailLabel")}
              </label>
              <input
                id="admin-email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="input-surface mt-1.5 py-3"
                placeholder={t("emailPlaceholder")}
                autoComplete="username"
              />
            </div>
            <div>
              <label htmlFor="admin-password" className="block text-sm font-medium text-slate-300">
                {t("passwordLabel")}
              </label>
              <input
                id="admin-password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="input-surface mt-1.5 py-3"
                placeholder={t("passwordPlaceholder")}
                autoComplete="current-password"
              />
            </div>
            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full rounded-xl bg-gradient-to-r from-cyan-400 to-brand-500 py-3 text-sm font-bold text-[#041016] shadow-md transition hover:brightness-110 disabled:opacity-50"
            >
              {isSubmitting ? t("submitting") : t("submit")}
            </button>
          </form>
        ) : (
          <form onSubmit={handleOtpSubmit} className="card-surface mt-6 space-y-4 rounded-3xl p-6">
            {devOtpHint ? (
              <p className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-200">
                {t("devCodeNotice")} <span className="font-mono font-semibold tracking-widest">{devOtpHint}</span>
              </p>
            ) : null}
            <div>
              <label htmlFor="admin-otp" className="block text-sm font-medium text-slate-300">
                {t("otpLabel")}
              </label>
              <input
                id="admin-otp"
                type="text"
                inputMode="numeric"
                autoComplete="one-time-code"
                maxLength={6}
                value={otpCode}
                onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                className="input-surface mt-1.5 py-3 text-center font-mono text-2xl tracking-[0.4em]"
                placeholder="••••••"
              />
            </div>
            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full rounded-xl bg-gradient-to-r from-cyan-400 to-brand-500 py-3 text-sm font-bold text-[#041016] shadow-md transition hover:brightness-110 disabled:opacity-50"
            >
              {isSubmitting ? t("otpSubmitting") : t("otpSubmit")}
            </button>
            <button
              type="button"
              onClick={handleBackToCredentials}
              disabled={isSubmitting}
              className="w-full text-sm font-medium text-slate-400 transition hover:text-white disabled:opacity-50"
            >
              {t("backToCredentials")}
            </button>
          </form>
        )}

        <p className="mt-4 text-center text-xs text-slate-400">{tCommon("securedBy")}</p>
      </main>
    </div>
  );
}
