import crypto from "crypto";
import { env } from "../config/env";

/** Generates a cryptographically-secure 6-digit numeric OTP code. */
export function generateOtpCode(): string {
  const otp = crypto.randomInt(0, 1_000_000);
  return otp.toString().padStart(6, "0");
}

export function getOtpExpiryDate(): Date {
  return new Date(Date.now() + env.OTP_EXPIRY_MINUTES * 60 * 1000);
}
