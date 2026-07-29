"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { OtpInput } from "@/components/OtpInput";
import { useToast } from "@/components/ToastProvider";
import { getApiErrorMessage } from "@/lib/api";
import { sendWithdrawalOtp } from "@/lib/transactions";

const RESEND_COOLDOWN_SECONDS = 60;

interface WithdrawalOtpModalProps {
  emailHint?: string;
  isSubmitting: boolean;
  onClose: () => void;
  onConfirm: (otpCode: string) => Promise<void>;
}

export function WithdrawalOtpModal({
  emailHint,
  isSubmitting,
  onClose,
  onConfirm,
}: WithdrawalOtpModalProps) {
  const t = useTranslations("withdraw.otpModal");
  const tOtp = useTranslations("otp");
  const { pushToast } = useToast();

  const [otpCode, setOtpCode] = useState("");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [cooldownSeconds, setCooldownSeconds] = useState(RESEND_COOLDOWN_SECONDS);
  const [isSending, setIsSending] = useState(false);
  const [didAutoSend, setDidAutoSend] = useState(false);

  useEffect(() => {
    if (didAutoSend) return;
    let cancelled = false;

    async function dispatch() {
      setIsSending(true);
      try {
        await sendWithdrawalOtp();
        if (cancelled) return;
        setCooldownSeconds(RESEND_COOLDOWN_SECONDS);
        pushToast(t("toasts.sent"), "info");
      } catch (error) {
        if (cancelled) return;
        const msg = getApiErrorMessage(error, t("errors.sendFailed"));
        setErrorMessage(msg);
        pushToast(msg, "error");
      } finally {
        if (!cancelled) {
          setIsSending(false);
          setDidAutoSend(true);
        }
      }
    }

    void dispatch();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [didAutoSend]);

  useEffect(() => {
    if (cooldownSeconds <= 0) return;
    const id = window.setTimeout(() => setCooldownSeconds((s) => s - 1), 1000);
    return () => window.clearTimeout(id);
  }, [cooldownSeconds]);

  async function handleResend() {
    if (cooldownSeconds > 0 || isSending) return;
    setErrorMessage(null);
    setIsSending(true);
    try {
      await sendWithdrawalOtp();
      setOtpCode("");
      setCooldownSeconds(RESEND_COOLDOWN_SECONDS);
      pushToast(t("toasts.sent"), "info");
    } catch (error) {
      const msg = getApiErrorMessage(error, t("errors.sendFailed"));
      setErrorMessage(msg);
      pushToast(msg, "error");
    } finally {
      setIsSending(false);
    }
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setErrorMessage(null);
    if (otpCode.length !== 6) {
      setErrorMessage(tOtp("errors.incomplete"));
      return;
    }
    try {
      await onConfirm(otpCode);
    } catch (error) {
      const msg = getApiErrorMessage(error, t("errors.invalid"));
      setErrorMessage(msg);
      pushToast(msg, "error");
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/55 p-4 backdrop-blur-sm">
      <div
        role="dialog"
        aria-modal="true"
        className="w-full max-w-md rounded-2xl border border-white/14 bg-white/[0.08] p-6 shadow-2xl backdrop-blur-sm"
      >
        <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-cyan-200/90">{t("eyebrow")}</p>
        <h2 className="mt-2 text-xl font-bold text-white">{t("title")}</h2>
        <p className="mt-2 text-sm leading-relaxed text-slate-300">
          {t("subtitle")}
          {emailHint ? (
            <>
              {" "}
              <span className="font-semibold text-slate-100">{emailHint}</span>
            </>
          ) : null}
        </p>

        {errorMessage ? (
          <div className="mt-4 rounded-xl border border-rose-400/25 bg-rose-500/10 px-3 py-2 text-sm text-rose-200">
            {errorMessage}
          </div>
        ) : null}

        <form onSubmit={(e) => void handleSubmit(e)} className="mt-6 space-y-5">
          <OtpInput value={otpCode} onChange={setOtpCode} disabled={isSubmitting || isSending} autoFocus />

          <button
            type="submit"
            disabled={isSubmitting || isSending || otpCode.length !== 6}
            className="w-full rounded-xl bg-gradient-to-r from-cyan-300 to-cyan-200 py-3 text-sm font-bold text-[#041016] shadow-[0_8px_24px_rgba(34,211,238,0.2)] disabled:opacity-50"
          >
            {isSubmitting ? t("submitting") : t("confirm")}
          </button>
        </form>

        <div className="mt-4 flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={() => void handleResend()}
            disabled={cooldownSeconds > 0 || isSending}
            className="text-sm font-semibold text-cyan-300 disabled:text-slate-400"
          >
            {isSending
              ? tOtp("resending")
              : cooldownSeconds > 0
                ? tOtp("resendCooldown", { seconds: cooldownSeconds })
                : tOtp("resend")}
          </button>
          <button
            type="button"
            onClick={onClose}
            disabled={isSubmitting}
            className="text-sm font-medium text-slate-400 hover:text-slate-300"
          >
            {t("cancel")}
          </button>
        </div>
      </div>
    </div>
  );
}
