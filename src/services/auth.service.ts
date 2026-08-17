import crypto from "crypto";
import type { User } from "@prisma/client";
import { prisma } from "../config/prisma";
import { env, isProduction } from "../config/env";
import { ApiError } from "../utils/apiError";
import { hashPassword, comparePassword } from "../utils/password";
import { signToken } from "../utils/jwt";
import { findUserByReferralCode, generateUniqueReferralCode } from "../utils/referral";
import type { LoginInput, RegisterInput, ResetPasswordInput } from "../validators/auth.validator";
import { issueOtp, consumeOtp } from "./otp.service";
import { queueEmail, sendPasswordResetEmail } from "./email.service";

function hashResetToken(rawToken: string): string {
  return crypto.createHash("sha256").update(rawToken).digest("hex");
}

function buildPasswordResetLink(rawToken: string): string {
  const base = env.APP_BASE_URL.replace(/\/+$/, "");
  return `${base}/reset-password?token=${encodeURIComponent(rawToken)}`;
}

export async function registerUser(input: RegisterInput): Promise<{ user: User; otpCode: string }> {
  const existingUser = await prisma.user.findUnique({ where: { email: input.email } });

  if (existingUser) {
    throw ApiError.conflict("auth.email_already_exists");
  }

  const existingId = await prisma.user.findUnique({
    where: { id_passport_number: input.idPassportNumber },
  });

  if (existingId) {
    throw ApiError.conflict("auth.id_already_exists");
  }

  let referrer: User | null = null;

  if (input.referralCode) {
    referrer = await findUserByReferralCode(input.referralCode);

    if (!referrer) {
      throw ApiError.badRequest("auth.invalid_referral_code");
    }

    // Defensive self-referral guard (same email as the referrer account).
    if (referrer.email.toLowerCase() === input.email.toLowerCase()) {
      throw ApiError.badRequest("auth.self_referral_not_allowed");
    }
  }

  const [passwordHash, referralCode] = await Promise.all([
    hashPassword(input.password),
    generateUniqueReferralCode(),
  ]);

  // Extremely unlikely, but never let a new account's code equal the invite used.
  let ownReferralCode = referralCode;
  if (input.referralCode && ownReferralCode === input.referralCode) {
    ownReferralCode = await generateUniqueReferralCode();
  }

  const user = await prisma.$transaction(async (tx) => {
    const created = await tx.user.create({
      data: {
        email: input.email,
        password_hash: passwordHash,
        language: input.language,
        referral_code: ownReferralCode,
        referred_by_id: referrer?.id ?? null,
        full_name: input.fullName,
        date_of_birth: input.dateOfBirth,
        id_passport_number: input.idPassportNumber,
        id_document_path: input.idDocumentPath,
        id_document_mime: input.idDocumentMime ?? null,
        id_document_data: input.idDocumentData ?? null,
        status: "PENDING",
        role: "USER",
        is_verified: false,
        referrals_count: 0,
      },
    });

    if (referrer) {
      // Re-check self-referral by id after create (always false for new UUID, kept for clarity).
      if (referrer.id === created.id) {
        throw ApiError.badRequest("auth.self_referral_not_allowed");
      }

      await tx.user.update({
        where: { id: referrer.id },
        data: { referrals_count: { increment: 1 } },
      });
    }

    return created;
  });

  const otpCode = await issueOtp(user.email, user.language, "EMAIL_VERIFY");

  return { user, otpCode };
}

export async function resubmitIdDocument(
  email: string,
  password: string,
  uploaded: { filename: string; mime: string; data: Buffer }
): Promise<{ email: string }> {
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) {
    throw ApiError.unauthorized("auth.invalid_credentials");
  }

  const passwordOk = await comparePassword(password, user.password_hash);
  if (!passwordOk) {
    throw ApiError.unauthorized("auth.invalid_credentials");
  }

  if (user.status === "BLOCKED") {
    throw ApiError.forbidden("auth.account_suspended");
  }

  if (!user.id_reupload_requested_at) {
    throw ApiError.forbidden("auth.id_reupload_not_requested");
  }

  await prisma.user.update({
    where: { id: user.id },
    data: {
      id_document_path: `/uploads/id-documents/${uploaded.filename}`,
      id_document_mime: uploaded.mime,
      id_document_data: uploaded.data,
      id_reupload_requested_at: null,
    },
  });

  return { email: user.email };
}

export async function verifyOtp(email: string, code: string): Promise<User> {
  const user = await prisma.user.findUnique({ where: { email } });

  if (!user) {
    throw ApiError.notFound("auth.user_not_found");
  }

  if (user.is_verified) {
    throw ApiError.badRequest("auth.already_verified");
  }

  await consumeOtp(email, code, "EMAIL_VERIFY");

  return prisma.user.update({ where: { email }, data: { is_verified: true } });
}

/** Issues a fresh EMAIL_VERIFY OTP for an existing, not-yet-verified account. */
export async function resendOtp(email: string, fallbackLang: string): Promise<string> {
  const user = await prisma.user.findUnique({ where: { email } });

  if (!user) {
    throw ApiError.notFound("auth.user_not_found");
  }

  if (user.is_verified) {
    throw ApiError.badRequest("auth.already_verified");
  }

  return issueOtp(email, user.language ?? fallbackLang, "EMAIL_VERIFY");
}

export async function loginUser(input: LoginInput): Promise<{ user: User; token: string }> {
  const user = await prisma.user.findUnique({ where: { email: input.email } });

  if (!user) {
    throw ApiError.unauthorized("auth.invalid_credentials");
  }

  const passwordMatches = await comparePassword(input.password, user.password_hash);

  if (!passwordMatches) {
    throw ApiError.unauthorized("auth.invalid_credentials");
  }

  if (!user.is_verified) {
    throw ApiError.forbidden("auth.account_not_verified");
  }

  if (user.status === "PENDING") {
    throw ApiError.forbidden("auth.account_pending", {
      idReuploadRequested: Boolean(user.id_reupload_requested_at),
    });
  }

  if (user.status !== "ACTIVE") {
    throw ApiError.forbidden("auth.account_suspended");
  }

  const token = signToken({ userId: user.id, role: user.role, language: user.language });

  return { user, token };
}

/**
 * Starts password reset. Always succeeds from the caller's perspective when the
 * email format is valid — never reveals whether the account exists.
 */
export async function requestPasswordReset(email: string): Promise<{ resetLink?: string }> {
  const user = await prisma.user.findUnique({ where: { email } });

  if (!user) {
    return {};
  }

  const rawToken = crypto.randomBytes(32).toString("hex");
  const tokenHash = hashResetToken(rawToken);
  const expiresAt = new Date(Date.now() + env.PASSWORD_RESET_EXPIRY_MINUTES * 60 * 1000);

  await prisma.$transaction([
    prisma.passwordResetToken.deleteMany({ where: { user_id: user.id } }),
    prisma.passwordResetToken.create({
      data: {
        user_id: user.id,
        token_hash: tokenHash,
        expires_at: expiresAt,
      },
    }),
  ]);

  const resetLink = buildPasswordResetLink(rawToken);
  queueEmail(() => sendPasswordResetEmail(user.email, resetLink), `password-reset:${user.email}`);

  return isProduction ? {} : { resetLink };
}

/** Completes password reset using a one-time email token. */
export async function resetPasswordWithToken(input: ResetPasswordInput): Promise<void> {
  const tokenHash = hashResetToken(input.token.trim());

  const record = await prisma.passwordResetToken.findUnique({
    where: { token_hash: tokenHash },
    include: { user: true },
  });

  if (!record || record.expires_at < new Date()) {
    if (record) {
      await prisma.passwordResetToken.delete({ where: { id: record.id } }).catch(() => undefined);
    }
    throw ApiError.badRequest("auth.reset_token_invalid");
  }

  const passwordHash = await hashPassword(input.newPassword);

  await prisma.$transaction([
    prisma.user.update({
      where: { id: record.user_id },
      data: { password_hash: passwordHash },
    }),
    prisma.passwordResetToken.deleteMany({ where: { user_id: record.user_id } }),
  ]);
}
