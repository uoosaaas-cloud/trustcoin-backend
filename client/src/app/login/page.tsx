"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { Suspense, useMemo, useState } from "react";
import { AuthChromeHeader } from "@/components/AuthChromeHeader";
import { TrustComplianceBlock } from "@/components/TrustCompliance";
import { getApiErrorMessage, getApiErrorKey } from "@/lib/api";
import { loginUser, persistAuthSession } from "@/lib/auth";
import { ADMIN_ROUTES } from "@/lib/adminPaths";
import { useToast } from "@/components/ToastProvider";

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
/** Where the user lands after logging in when no `next` redirect param is present. */
const DEFAULT_POST_LOGIN_PATH = "/dashboard";

export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginForm />
    </Suspense>
  );
}

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const t = useTranslations("login");
  const tCommon = useTranslations("common");
  const { pushToast } = useToast();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isPasswordVisible, setIsPasswordVisible] = useState(false);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const isEmailValid = email.length === 0 || EMAIL_REGEX.test(email.trim());

  // Preserves where the user was trying to go (e.g. the deposit page's auth
  // guard redirects here as `/login?next=/deposit`) so login returns them
  // to the right place instead of always landing on the same default page.
  const redirectTarget = useMemo(() => {
    const next = searchParams.get("next");
    return next && next.startsWith("/") ? next : DEFAULT_POST_LOGIN_PATH;
  }, [searchParams]);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setErrorMessage(null);

    const trimmedEmail = email.trim();

    if (trimmedEmail.length === 0 || !EMAIL_REGEX.test(trimmedEmail)) {
      setErrorMessage(t("errors.emailRequired"));
      return;
    }

    if (password.length === 0) {
      setErrorMessage(t("errors.passwordRequired"));
      return;
    }

    setIsSubmitting(true);

    try {
      const response = await loginUser({ email: trimmedEmail.toLowerCase(), password });
      persistAuthSession(response.data);
      const destination =
        response.data.user.role === "ADMIN" && redirectTarget === DEFAULT_POST_LOGIN_PATH
          ? ADMIN_ROUTES.home
          : redirectTarget;
      router.push(destination);
    } catch (error) {
      const key = getApiErrorKey(error);
      if (key === "auth.account_not_verified") {
        pushToast(getApiErrorMessage(error, t("errors.generic")), "info");
        router.push(`/already-registered/verify-email?email=${encodeURIComponent(trimmedEmail.toLowerCase())}`);
        return;
      }
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
            <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-cyan-300 sm:text-xs">{t("eyebrow")}</p>
            <h1 className="mt-2.5 text-2xl font-bold tracking-tight text-white sm:text-[2rem] sm:leading-tight">
              {t("title")}
            </h1>
            <p className="mt-2.5 text-[15px] leading-relaxed text-slate-400">{t("subtitle")}</p>

            <form onSubmit={handleSubmit} className="mt-8 space-y-5">
              <Field label={t("emailLabel")}>
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
                {!isEmailValid && <FieldError message={t("errors.emailRequired")} />}
              </Field>

              <Field
                label={
                  <span className="flex items-center justify-between">
                    {t("passwordLabel")}
                    <Link href="/forgot-password" className="text-xs font-semibold text-cyan-300 hover:text-cyan-200">
                      {t("forgotPassword")}
                    </Link>
                  </span>
                }
              >
                <div className="relative">
                  <input
                    type={isPasswordVisible ? "text" : "password"}
                    required
                    autoComplete="current-password"
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
                    className="absolute inset-y-0 end-2 flex items-center px-2 text-slate-400 transition hover:text-slate-300"
                  >
                    {isPasswordVisible ? <EyeOffIcon /> : <EyeIcon />}
                  </button>
                </div>
              </Field>

              {errorMessage && <ErrorBanner message={errorMessage} />}

              <button type="submit" disabled={isSubmitting} className={primaryButtonClassName}>
                {isSubmitting ? t("submitting") : t("submit")}
              </button>
            </form>

            <p className="mt-6 text-center text-sm text-slate-400">
              {t("noAccount")}{" "}
              <Link href="/register" className="font-semibold text-cyan-300 hover:text-cyan-200">
                {t("register")}
              </Link>
            </p>
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

function Field({ label, children }: { label: React.ReactNode; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-sm font-medium text-slate-300">{label}</span>
      {children}
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

const primaryButtonClassName =
  "w-full rounded-xl bg-gradient-to-r from-cyan-400 to-cyan-300 px-4 py-3 text-sm font-bold text-[#041016] shadow-[0_12px_40px_rgba(34,211,238,0.22)] transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-50 disabled:shadow-none";
