/**
 * Legacy mail helpers — kept for backward compatibility.
 * Delivery now goes through Resend (`email.service.ts`) when RESEND_API_KEY is set.
 */
import {
  sendVerificationEmail,
  sendWithdrawalOtpEmail as sendWithdrawalOtpViaResend,
} from "../services/email.service";

/** @deprecated Prefer `sendVerificationEmail` from email.service */
export async function sendOtpEmail(to: string, code: string, _lang: string): Promise<void> {
  await sendVerificationEmail(to, code);
}

/** @deprecated Prefer email.service `sendWithdrawalOtpEmail` */
export async function sendWithdrawalOtpEmail(to: string, code: string, _lang: string): Promise<void> {
  await sendWithdrawalOtpViaResend(to, code);
}
