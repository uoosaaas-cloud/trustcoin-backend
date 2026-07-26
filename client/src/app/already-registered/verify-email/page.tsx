"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { Suspense, useEffect, useState } from "react";
import { AuthChromeHeader } from "@/components/AuthChromeHeader";
import { OtpInput } from "@/components/OtpInput";
import { useToast } from "@/components/ToastProvider";
import { getApiErrorMessage } from "@/lib/api";
import { resendOtp, verifyOtp } from "@/lib/auth";

const RESEND_COOLDOWN_SECONDS = 60;
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default function AlreadyRegisteredVerifyEmailPage() {
  return (
    <Suspense fallback={null}>
      <VerifyEmailForm />
    </Suspense>
  );
}

function VerifyEmailForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const t = useTranslations("otp");
  const tVerify = useTranslations("verifyEmail");
  const tCommon = useTranslations("common");
  const { pushToast } = useToast();

  const [email, setEmail] = useState("");
  const [otpCode, setOtpCode] = useState("");
  const [cooldownSeconds, setCooldownSeconds] = useState(0);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isResending, setIsResending] = useState(false);
  const [isVerified, setIsVerified] = useState(false);
  const [pendingApproval, setPendingApproval] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    const prefill = searchParams.get("email")?.trim().toLowerCase() ?? "";
    if (prefill) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setEmail(prefill);
    }
  }, [searchParams]);

  useEffect(() => {
    if (cooldownSeconds <= 0) return;
    const id = window.setTimeout(() => setCooldownSeconds((s) => s - 1), 1000);
    return () => window.clearTimeout(id);
  }, [cooldownSeconds]);

  async function handleVerify(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setErrorMessage(null);

    const trimmed = email.trim().toLowerCase();
    if (!EMAIL_REGEX.test(trimmed)) {
      setErrorMessage(tVerify("errors.emailRequired"));
      return;
    }
    if (otpCode.length !== 6) {
      setErrorMessage(t("errors.incomplete"));
      return;
    }

    setIsSubmitting(true);
    try {
      const response = await verifyOtp({ email: trimmed, code: otpCode });
      setPendingApproval(response.data.status === "PENDING");
      setIsVerified(true);
      pushToast(tVerify("toasts.verified"), "success");
    } catch (error) {
      const msg = getApiErrorMessage(error, t("errors.invalid"));
      setErrorMessage(msg);
      pushToast(msg, "error");
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleResend() {
    if (cooldownSeconds > 0 || isResending) return;
    setErrorMessage(null);

    const trimmed = email.trim().toLowerCase();
    if (!EMAIL_REGEX.test(trimmed)) {
      setErrorMessage(tVerify("errors.emailRequired"));
      return;
    }

    setIsResending(true);
    try {
      await resendOtp({ email: trimmed });
      setOtpCode("");
      setCooldownSeconds(RESEND_COOLDOWN_SECONDS);
      pushToast(tVerify("toasts.sent"), "info");
    } catch (error) {
      const msg = getApiErrorMessage(error, t("errors.generic"));
      setErrorMessage(msg);
      pushToast(msg, "error");
    } finally {
      setIsResending(false);
    }
  }

  return (
    <div className="page-shell flex flex-col">
      <AuthChromeHeader brandHref="/" />

      <main className="relative z-10 flex flex-1 items-center justify-center px-4 py-10 sm:px-6">
        <div className="w-full max-w-lg">
          <div className="card-surface animate-fade-in-up rounded-[1.5rem] p-7 sm:p-9">
            {isVerified ? (
              <>
                <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-brand-500">
                  {t("eyebrow")}
                </p>
                <h1 className="mt-2.5 text-2xl font-bold tracking-tight text-slate-900">
                  {pendingApproval ? t("successPending") : t("success")}
                </h1>
                {pendingApproval ? (
                  <p className="mt-3 text-sm leading-relaxed text-slate-600">{t("successPendingHint")}</p>
                ) : null}
                <button
                  type="button"
                  onClick={() => router.push("/login")}
                  className="mt-8 w-full rounded-xl bg-gradient-to-r from-brand-500 to-brand-600 py-3 text-sm font-semibold text-white shadow-lg shadow-brand-500/25"
                >
                  {t("goToLogin")}
                </button>
              </>
            ) : (
              <>
                <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-brand-500">
                  {tVerify("eyebrow")}
                </p>
                <h1 className="mt-2.5 text-2xl font-bold tracking-tight text-slate-900">{tVerify("title")}</h1>
                <p className="mt-2.5 text-[15px] leading-relaxed text-slate-600">{tVerify("subtitle")}</p>

                {errorMessage ? (
                  <div className="mt-5 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
                    {errorMessage}
                  </div>
                ) : null}

                <form onSubmit={handleVerify} className="mt-7 space-y-5">
                  <div>
                    <label htmlFor="verify-email" className="block text-sm font-medium text-slate-700">
                      {tVerify("emailLabel")}
                    </label>
                    <input
                      id="verify-email"
                      type="email"
                      autoComplete="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="input-surface mt-1.5 py-3"
                      placeholder={tVerify("emailPlaceholder")}
                    />
                  </div>

                  <div>
                    <p className="mb-3 text-center text-sm font-medium text-slate-700">{t("codeLabel")}</p>
                    <OtpInput value={otpCode} onChange={setOtpCode} disabled={isSubmitting} autoFocus />
                  </div>

                  <button
                    type="submit"
                    disabled={isSubmitting || otpCode.length !== 6}
                    className="w-full rounded-xl bg-gradient-to-r from-brand-500 to-brand-600 py-3 text-sm font-semibold text-white shadow-lg shadow-brand-500/25 disabled:opacity-50"
                  >
                    {isSubmitting ? t("submitting") : t("submit")}
                  </button>
                </form>

                <div className="mt-5 flex flex-col items-center gap-2">
                  <button
                    type="button"
                    onClick={() => void handleResend()}
                    disabled={cooldownSeconds > 0 || isResending}
                    className="text-sm font-semibold text-brand-600 disabled:text-slate-400"
                  >
                    {isResending
                      ? t("resending")
                      : cooldownSeconds > 0
                        ? t("resendCooldown", { seconds: cooldownSeconds })
                        : t("resend")}
                  </button>
                  <Link href="/login" className="text-xs text-slate-500 hover:text-slate-700">
                    {tCommon("back")} · {t("goToLogin")}
                  </Link>
                </div>
              </>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
