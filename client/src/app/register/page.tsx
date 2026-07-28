"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { Suspense, useEffect, useState } from "react";
import { AuthChromeHeader } from "@/components/AuthChromeHeader";
import { OtpInput } from "@/components/OtpInput";
import { TrustComplianceBlock } from "@/components/TrustCompliance";
import { useToast } from "@/components/ToastProvider";
import { getApiErrorMessage } from "@/lib/api";
import { registerUser, resendOtp, verifyOtp } from "@/lib/auth";
import type { Locale } from "@/i18n/config";

const STRONG_PASSWORD_REGEX = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9]).{8,}$/;
const RESEND_COOLDOWN_SECONDS = 60;
const ALLOWED_ID_TYPES = new Set(["image/jpeg", "image/jpg", "image/png", "image/webp"]);
const MAX_ID_BYTES = 5 * 1024 * 1024;

type Step = "register" | "otp" | "success";

export default function RegisterPage() {
  return (
    <Suspense fallback={null}>
      <RegisterForm />
    </Suspense>
  );
}

function RegisterForm() {
  const locale = useLocale() as Locale;
  const searchParams = useSearchParams();
  const tRegister = useTranslations("register");
  const tOtp = useTranslations("otp");
  const tCommon = useTranslations("common");
  const { pushToast } = useToast();

  const [step, setStep] = useState<Step>("register");

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [referralCode, setReferralCode] = useState("");
  const [idPassportNumber, setIdPassportNumber] = useState("");
  const [idDocument, setIdDocument] = useState<File | null>(null);

  const [otpCode, setOtpCode] = useState("");
  const [pendingApproval, setPendingApproval] = useState(true);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isResending, setIsResending] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [cooldownSeconds, setCooldownSeconds] = useState(0);

  useEffect(() => {
    const refFromUrl = searchParams.get("ref")?.trim().toUpperCase();
    if (refFromUrl) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setReferralCode(refFromUrl);
    }
  }, [searchParams]);

  useEffect(() => {
    if (cooldownSeconds <= 0) {
      return;
    }
    const timer = setInterval(() => {
      setCooldownSeconds((seconds) => Math.max(0, seconds - 1));
    }, 1000);
    return () => clearInterval(timer);
  }, [cooldownSeconds]);

  const passwordsMatch = confirmPassword.length === 0 || password === confirmPassword;
  const isPasswordStrongEnough = password.length === 0 || STRONG_PASSWORD_REGEX.test(password);
  const isEmailValid = email.length === 0 || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());

  async function handleRegisterSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    setErrorMessage(null);

    if (email.trim().length <= 3 || !isEmailValid) {
      setErrorMessage(tRegister("errors.emailRequired"));
      return;
    }

    if (!STRONG_PASSWORD_REGEX.test(password)) {
      setErrorMessage(tRegister("errors.passwordWeak"));
      return;
    }

    if (password !== confirmPassword) {
      setErrorMessage(tRegister("errors.passwordMismatch"));
      return;
    }

    if (idPassportNumber.trim().length < 4) {
      setErrorMessage(tRegister("errors.idRequired"));
      return;
    }

    if (!idDocument) {
      setErrorMessage(tRegister("errors.idDocumentRequired"));
      return;
    }

    if (!ALLOWED_ID_TYPES.has(idDocument.type)) {
      setErrorMessage(tRegister("errors.idDocumentType"));
      return;
    }

    if (idDocument.size > MAX_ID_BYTES) {
      setErrorMessage(tRegister("errors.idDocumentTooLarge"));
      return;
    }

    setIsSubmitting(true);

    try {
      await registerUser({
        email: email.trim().toLowerCase(),
        password,
        language: locale,
        referralCode: referralCode.trim() || undefined,
        idPassportNumber: idPassportNumber.trim(),
        idDocument,
      });

      // Note: in non-production environments the backend may still return
      // `otpCode` in the response for automated/API testing, but the UI
      // intentionally ignores it — the user must always retrieve the code
      // from their inbox (Mailtrap in dev) and type it in manually.
      setCooldownSeconds(RESEND_COOLDOWN_SECONDS);
      setStep("otp");
      pushToast(tOtp("toasts.sent"), "info");
    } catch (error) {
      setErrorMessage(getApiErrorMessage(error, tCommon("unknownError")));
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleOtpSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setErrorMessage(null);

    if (otpCode.length !== 6) {
      setErrorMessage(tOtp("errors.incomplete"));
      return;
    }

    setIsSubmitting(true);

    try {
      const response = await verifyOtp({ email: email.trim().toLowerCase(), code: otpCode });
      setPendingApproval(response.data.status === "PENDING");
      setStep("success");
      pushToast(tOtp("toasts.verified"), "success");
    } catch (error) {
      const msg = getApiErrorMessage(error, tOtp("errors.generic"));
      setErrorMessage(msg);
      pushToast(msg, "error");
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleResendOtp() {
    if (cooldownSeconds > 0 || isResending) {
      return;
    }

    setErrorMessage(null);
    setIsResending(true);

    try {
      await resendOtp({ email: email.trim().toLowerCase() });
      setOtpCode("");
      setCooldownSeconds(RESEND_COOLDOWN_SECONDS);
      pushToast(tOtp("toasts.sent"), "info");
    } catch (error) {
      const msg = getApiErrorMessage(error, tOtp("errors.generic"));
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
          {step !== "success" && (
            <div className="mb-7 flex items-center justify-center gap-2">
              <StepDot active={step === "register"} done={step === "otp"} label="1" />
              <span className="h-px w-12 bg-slate-200" />
              <StepDot active={step === "otp"} done={false} label="2" />
            </div>
          )}

          <div className="card-surface animate-fade-in-up rounded-[1.5rem] p-7 sm:p-9">
            {step === "register" && (
              <>
                <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-cyan-300 sm:text-xs">
                  {tRegister("eyebrow")}
                </p>
                <h1 className="mt-2.5 text-2xl font-bold tracking-tight text-white sm:text-[2rem] sm:leading-tight">
                  {tRegister("title")}
                </h1>
                <p className="mt-2.5 text-[15px] leading-relaxed text-slate-400">{tRegister("subtitle")}</p>

                <form onSubmit={handleRegisterSubmit} className="mt-8 space-y-5">
                  <Field label={tRegister("emailLabel")}>
                    <input
                      type="email"
                      required
                      autoComplete="email"
                      value={email}
                      onChange={(event) => setEmail(event.target.value)}
                      placeholder={tRegister("emailPlaceholder")}
                      className={`input-surface ${!isEmailValid ? "border-rose-300 focus:border-rose-400 focus:ring-rose-400/20" : ""}`}
                      dir="ltr"
                    />
                    {!isEmailValid && <FieldError message={tRegister("errors.emailRequired")} />}
                  </Field>

                  <Field label={tRegister("passwordLabel")} hint={tRegister("passwordHint")}>
                    <input
                      type="password"
                      required
                      autoComplete="new-password"
                      value={password}
                      onChange={(event) => setPassword(event.target.value)}
                      placeholder={tRegister("passwordPlaceholder")}
                      className={`input-surface ${
                        !isPasswordStrongEnough ? "border-rose-300 focus:border-rose-400 focus:ring-rose-400/20" : ""
                      }`}
                      dir="ltr"
                    />
                    {!isPasswordStrongEnough && <FieldError message={tRegister("errors.passwordWeak")} />}
                  </Field>

                  <Field label={tRegister("confirmPasswordLabel")}>
                    <input
                      type="password"
                      required
                      autoComplete="new-password"
                      value={confirmPassword}
                      onChange={(event) => setConfirmPassword(event.target.value)}
                      placeholder={tRegister("confirmPasswordPlaceholder")}
                      className={`input-surface ${!passwordsMatch ? "border-rose-300 focus:border-rose-400 focus:ring-rose-400/20" : ""}`}
                      dir="ltr"
                    />
                    {!passwordsMatch && <FieldError message={tRegister("errors.passwordMismatch")} />}
                  </Field>

                  <Field label={tRegister("idPassportLabel")} hint={tRegister("idPassportHint")}>
                    <input
                      type="text"
                      required
                      value={idPassportNumber}
                      onChange={(event) => setIdPassportNumber(event.target.value)}
                      placeholder={tRegister("idPassportPlaceholder")}
                      className="input-surface"
                      dir="ltr"
                      autoComplete="off"
                    />
                  </Field>

                  <Field label={tRegister("idDocumentLabel")} hint={tRegister("idDocumentHint")}>
                    <input
                      type="file"
                      accept="image/jpeg,image/png,image/webp,.jpg,.jpeg,.png,.webp"
                      required
                      onChange={(event) => setIdDocument(event.target.files?.[0] ?? null)}
                      className="block w-full text-sm text-slate-400 file:me-3 file:rounded-lg file:border-0 file:bg-cyan-400/10 file:px-3 file:py-2 file:text-sm file:font-semibold file:text-cyan-300 hover:file:bg-brand-100"
                    />
                    {idDocument ? (
                      <span className="mt-1.5 block text-xs text-slate-400" dir="ltr">
                        {idDocument.name}
                      </span>
                    ) : null}
                  </Field>

                  <Field
                    label={
                      <span>
                        {tRegister("referralCodeLabel")}{" "}
                        <span className="text-slate-400">({tRegister("referralCodeOptional")})</span>
                      </span>
                    }
                  >
                    <input
                      type="text"
                      value={referralCode}
                      onChange={(event) => setReferralCode(event.target.value.toUpperCase())}
                      placeholder={tRegister("referralCodePlaceholder")}
                      className="input-surface"
                      dir="ltr"
                    />
                  </Field>

                  {errorMessage && <ErrorBanner message={errorMessage} />}

                  {/*
                    The button stays enabled (except while a request is in
                    flight) even if the fields aren't valid yet. Disabling it
                    based on client-side validation made the button look
                    "unresponsive" whenever a rule silently failed — clicking
                    submit now always runs handleRegisterSubmit, which
                    re-validates and surfaces a clear error banner + inline
                    field errors above instead.
                  */}
                  <button type="submit" disabled={isSubmitting} className={primaryButtonClassName}>
                    {isSubmitting ? tRegister("submitting") : tRegister("submit")}
                  </button>
                </form>

                <p className="mt-6 text-center text-sm text-slate-400">
                  {tRegister("haveAccount")}{" "}
                  <Link href="/login" className="font-semibold text-cyan-300 hover:text-cyan-200">
                    {tRegister("login")}
                  </Link>
                </p>
              </>
            )}

            {step === "otp" && (
              <>
                <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-cyan-300 sm:text-xs">
                  {tOtp("eyebrow")}
                </p>
                <h1 className="mt-2.5 text-2xl font-bold tracking-tight text-white sm:text-[2rem] sm:leading-tight">
                  {tOtp("title")}
                </h1>
                <p className="mt-2.5 text-[15px] leading-relaxed text-slate-400">
                  {tOtp("subtitle")} <span dir="ltr" className="font-medium text-slate-100">{email}</span>
                </p>

                <form onSubmit={handleOtpSubmit} className="mt-8 space-y-6">
                  <OtpInput value={otpCode} onChange={setOtpCode} disabled={isSubmitting} autoFocus />

                  {errorMessage && <ErrorBanner message={errorMessage} />}

                  <button
                    type="submit"
                    disabled={isSubmitting || otpCode.length !== 6}
                    className={primaryButtonClassName}
                  >
                    {isSubmitting ? tOtp("submitting") : tOtp("submit")}
                  </button>
                </form>

                <div className="mt-6 flex items-center justify-between text-sm">
                  <button
                    type="button"
                    onClick={() => {
                      setStep("register");
                      setOtpCode("");
                      setErrorMessage(null);
                    }}
                    className="text-slate-400 transition hover:text-white"
                  >
                    {tOtp("changeEmail")}
                  </button>

                  <button
                    type="button"
                    onClick={handleResendOtp}
                    disabled={cooldownSeconds > 0 || isResending}
                    className="font-semibold text-cyan-300 transition hover:text-cyan-300 disabled:cursor-not-allowed disabled:text-slate-400"
                  >
                    {isResending
                      ? tOtp("resending")
                      : cooldownSeconds > 0
                        ? tOtp("resendCooldown", { seconds: cooldownSeconds })
                        : tOtp("resend")}
                  </button>
                </div>
              </>
            )}

            {step === "success" && (
              <div className="text-center">
                <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-cyan-400/10 text-3xl text-cyan-300">
                  ✓
                </div>
                <h1 className="mt-5 text-2xl font-bold tracking-tight text-white sm:text-[1.75rem]">
                  {pendingApproval ? tOtp("successPending") : tOtp("success")}
                </h1>
                <p className="mt-2.5 text-[15px] leading-relaxed text-slate-400">
                  {pendingApproval ? tOtp("successPendingHint") : null}
                </p>
                <Link
                  href="/login"
                  className={`${primaryButtonClassName} mt-8 inline-flex items-center justify-center`}
                >
                  {tOtp("goToLogin")}
                </Link>
              </div>
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

function StepDot({ active, done, label }: { active: boolean; done: boolean; label: string }) {
  return (
    <span
      className={`flex h-7 w-7 items-center justify-center rounded-full text-xs font-semibold transition ${
        active
          ? "bg-cyan-400/100 text-white shadow-[0_12px_40px_rgba(34,211,238,0.22)]"
          : done
            ? "bg-brand-100 text-cyan-300"
            : "bg-white/10 text-slate-400"
      }`}
    >
      {done ? "✓" : label}
    </span>
  );
}

function Field({
  label,
  hint,
  children,
}: {
  label: React.ReactNode;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-sm font-medium text-slate-300">{label}</span>
      {children}
      {hint && <span className="mt-1.5 block text-xs text-slate-400">{hint}</span>}
    </label>
  );
}

function ErrorBanner({ message }: { message: string }) {
  return (
    <div className="rounded-xl border border-rose-400/30 bg-rose-500/10 px-3.5 py-2.5 text-sm text-rose-300">
      {message}
    </div>
  );
}

function FieldError({ message }: { message: string }) {
  return (
    <span role="alert" className="mt-1.5 flex items-center gap-1 text-xs font-medium text-rose-300">
      <span aria-hidden>⚠</span>
      {message}
    </span>
  );
}

const primaryButtonClassName =
  "w-full rounded-xl bg-gradient-to-r from-cyan-400 to-cyan-300 px-4 py-3 text-sm font-bold text-[#041016] shadow-[0_12px_40px_rgba(34,211,238,0.22)] transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-50 disabled:shadow-none";
