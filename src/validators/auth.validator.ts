import { z } from "zod";
import { normalizeReferralCodeInput } from "../utils/referral";

// At least 8 chars, one uppercase, one lowercase, one digit, and one special character.
const STRONG_PASSWORD_REGEX = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9]).+$/;

const emailField = z.string().trim().toLowerCase().email("Please provide a valid email address.");

const strongPasswordField = z
  .string()
  .min(8, "Password must be at least 8 characters long.")
  .max(128, "Password must be at most 128 characters long.")
  .regex(
    STRONG_PASSWORD_REGEX,
    "Password must contain at least one uppercase letter, one lowercase letter, one number, and one special character."
  );

const optionalReferralCode = z
  .string()
  .trim()
  .optional()
  .transform((value) => {
    if (!value) return undefined;
    const normalized = normalizeReferralCodeInput(value);
    return normalized || undefined;
  });

/**
 * Multipart register body — every field arrives as a string.
 * Accepts either `referralCode` or `ref` (query-style invite param).
 */
export const registerSchema = z.preprocess(
  (raw) => {
    if (!raw || typeof raw !== "object") return raw;
    const body = { ...(raw as Record<string, unknown>) };
    if (!body.referralCode && typeof body.ref === "string") {
      body.referralCode = body.ref;
    }
    return body;
  },
  z.object({
    email: emailField,
    password: strongPasswordField,
    language: z.enum(["en", "ar"]).default("en"),
    referralCode: optionalReferralCode,
    ref: z.string().optional(),
    idPassportNumber: z
      .string()
      .trim()
      .min(4, "ID / Passport number is required.")
      .max(64, "ID / Passport number must be at most 64 characters."),
  })
);

export const loginSchema = z.object({
  email: emailField,
  password: z.string().min(1, "Password is required."),
});

export const verifyOtpSchema = z.object({
  email: emailField,
  code: z.string().regex(/^\d{6}$/, "Verification code must be exactly 6 digits."),
});

export const resendOtpSchema = z.object({
  email: emailField,
});

export const forgotPasswordSchema = z.object({
  email: emailField,
});

export const resetPasswordSchema = z.object({
  token: z.string().trim().min(32, "Reset token is required.").max(128),
  newPassword: strongPasswordField,
});

export type RegisterInput = z.infer<typeof registerSchema> & {
  idDocumentPath: string;
};
export type LoginInput = z.infer<typeof loginSchema>;
export type VerifyOtpInput = z.infer<typeof verifyOtpSchema>;
export type ResendOtpInput = z.infer<typeof resendOtpSchema>;
export type ForgotPasswordInput = z.infer<typeof forgotPasswordSchema>;
export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>;
