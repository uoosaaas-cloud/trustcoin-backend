import type { Request } from "express";
import rateLimit from "express-rate-limit";
import { env, isProduction } from "../config/env";
import { translate } from "../utils/i18n";

/** Normalize Express / Node IPv4-mapped IPv6 addresses (e.g. ::ffff:127.0.0.1). */
function normalizeIp(ip: string): string {
  return ip.replace(/^::ffff:/i, "").trim().toLowerCase();
}

/** True for loopback / local machine clients — never rate-limit these in practice. */
export function isLocalhostRequest(req: Request): boolean {
  const candidates = [
    req.ip,
    req.socket?.remoteAddress,
    ...(Array.isArray(req.headers["x-forwarded-for"])
      ? req.headers["x-forwarded-for"]
      : String(req.headers["x-forwarded-for"] ?? "").split(",")),
  ]
    .filter(Boolean)
    .map((value) => normalizeIp(String(value).split(",")[0] ?? ""));

  return candidates.some(
    (ip) => ip === "127.0.0.1" || ip === "::1" || ip === "localhost"
  );
}

/** Admin login / OTP paths — have a dedicated brute-force limiter. */
export function isAdminLoginPath(req: Request): boolean {
  const path = req.originalUrl?.split("?")[0] ?? req.path ?? "";
  return (
    path === "/api/v1/admin/login" ||
    path.endsWith("/admin/login") ||
    path === "/api/v1/admin/verify-login-otp" ||
    path.endsWith("/admin/verify-login-otp")
  );
}

const tooManyMessage = { success: false, message: translate("errors.too_many_requests") };

/** General-purpose limiter applied to the whole API (including authenticated admin). */
export const globalRateLimiter = rateLimit({
  windowMs: env.RATE_LIMIT_WINDOW_MS,
  max: env.RATE_LIMIT_MAX,
  standardHeaders: true,
  legacyHeaders: false,
  message: tooManyMessage,
  skip: (req) => isLocalhostRequest(req) || isAdminLoginPath(req),
});

/** Stricter limiter for sensitive auth endpoints (login, register, OTP) to slow down brute force. */
export const authRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: isProduction ? 10 : 200,
  standardHeaders: true,
  legacyHeaders: false,
  message: tooManyMessage,
  skip: (req) => isLocalhostRequest(req),
});

/**
 * Separate from login/register so a few failed sign-in attempts cannot
 * block KYC photo re-upload from the pending-approval page.
 */
export const idResubmitRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: isProduction ? 20 : 200,
  standardHeaders: true,
  legacyHeaders: false,
  message: tooManyMessage,
  skip: (req) => isLocalhostRequest(req),
});

/**
 * IP-scoped guard for the resend-OTP endpoint: at most one request per
 * minute per IP. This is a secondary defense — the authoritative, per-email
 * cooldown is enforced in `auth.service.ts` regardless of the caller's IP.
 */
export const resendOtpRateLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: isProduction ? 1 : 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: tooManyMessage,
  skip: (req) => isLocalhostRequest(req),
});

/**
 * Admin panel login limiter (brute-force defense).
 * Localhost skipped; production is intentionally strict.
 */
export const adminLoginRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: isProduction ? 10 : 200,
  standardHeaders: true,
  legacyHeaders: false,
  message: tooManyMessage,
  skip: (req) => isLocalhostRequest(req),
});

/**
 * Extra throttle for authenticated admin mutations (approve/reject/sweep/delete).
 * Applied after authMiddleware so stolen JWTs cannot hammer sensitive actions.
 */
export const adminActionsRateLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: isProduction ? 60 : 500,
  standardHeaders: true,
  legacyHeaders: false,
  message: tooManyMessage,
  skip: (req) => isLocalhostRequest(req),
});
