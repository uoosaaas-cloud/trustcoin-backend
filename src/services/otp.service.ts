import type { OtpPurpose } from "@prisma/client";
import { prisma } from "../config/prisma";
import { env, isProduction } from "../config/env";
import { ApiError } from "../utils/apiError";
import { generateOtpCode, getOtpExpiryDate } from "../utils/otp";
import {
  queueEmail,
  sendAdminLoginOtp,
  sendVerificationEmail,
  sendWithdrawalOtpEmail,
} from "./email.service";

/**
 * Throws `429` if less than `OTP_RESEND_COOLDOWN_SECONDS` have elapsed since
 * the most recent OTP of the same purpose for this email.
 */
export async function assertOtpCooldownElapsed(email: string, purpose: OtpPurpose): Promise<void> {
  const latestOtp = await prisma.otpVerification.findFirst({
    where: { email, purpose },
    orderBy: { created_at: "desc" },
  });

  if (!latestOtp) {
    return;
  }

  const cooldownMs = env.OTP_RESEND_COOLDOWN_SECONDS * 1000;
  const elapsedMs = Date.now() - latestOtp.created_at.getTime();

  if (elapsedMs < cooldownMs) {
    const remainingSeconds = Math.ceil((cooldownMs - elapsedMs) / 1000);
    throw ApiError.tooManyRequests("auth.otp_resend_cooldown", { seconds: remainingSeconds });
  }
}

/**
 * Issues a 6-digit OTP for the given purpose, emails it (non-blocking), and
 * returns the raw code (exposed outside production for local testing only).
 */
export async function issueOtp(
  email: string,
  lang: string,
  purpose: OtpPurpose
): Promise<string> {
  await assertOtpCooldownElapsed(email, purpose);

  const code = generateOtpCode();

  await prisma.otpVerification.create({
    data: {
      email,
      code,
      purpose,
      expires_at: getOtpExpiryDate(),
    },
  });

  // Fire-and-forget — OTP row is already persisted; email failure must not block.
  if (purpose === "WITHDRAWAL") {
    queueEmail(() => sendWithdrawalOtpEmail(email, code), `withdrawal-otp:${email}`);
  } else if (purpose === "ADMIN_LOGIN") {
    queueEmail(() => sendAdminLoginOtp(email, code), `admin-login-otp:${email}`);
  } else {
    queueEmail(() => sendVerificationEmail(email, code), `verify-otp:${email}`);
  }

  if (!isProduction) {
    // eslint-disable-next-line no-console
    console.info(`[otp] Issued ${purpose} code for ${email} (lang=${lang})`);
  }

  return code;
}

/**
 * Validates an OTP for the given purpose and deletes matching codes.
 * Does not mutate user state — callers handle side effects.
 */
export async function consumeOtp(email: string, code: string, purpose: OtpPurpose): Promise<void> {
  const otp = await prisma.otpVerification.findFirst({
    where: { email, code, purpose },
    orderBy: { created_at: "desc" },
  });

  if (!otp || otp.expires_at < new Date()) {
    throw ApiError.badRequest("auth.otp_invalid");
  }

  await prisma.otpVerification.deleteMany({ where: { email, purpose } });
}
