import { NextFunction, Request, Response } from "express";
import { prisma } from "../config/prisma";
import { env } from "../config/env";
import { ApiError } from "../utils/apiError";
import { asyncHandler } from "../utils/asyncHandler";

export function getClientIp(req: Request): string {
  const forwarded = req.headers["x-forwarded-for"];
  if (typeof forwarded === "string" && forwarded.length > 0) {
    return forwarded.split(",")[0].trim();
  }
  return req.socket.remoteAddress ?? req.ip ?? "unknown";
}

/** Blocks requests from IP addresses already recorded in the BannedIp table. Intended for admin routes. */
export const ipGuardMiddleware = asyncHandler(async (req: Request, _res: Response, next: NextFunction) => {
  const ip = getClientIp(req);

  const banned = await prisma.bannedIp.findUnique({ where: { ip_address: ip } });

  if (banned) {
    throw ApiError.forbidden("errors.ip_banned");
  }

  next();
});

// In-memory countdown of failed admin-login attempts per IP, before the IP
// is persisted to the BannedIp table. Not shared across multiple server
// instances — for multi-instance deployments, back this with Redis instead.
const failedAttemptCounts = new Map<string, number>();

/**
 * Records a failed admin-login attempt for an IP address. Once the number
 * of failed attempts reaches `ADMIN_MAX_FAILED_ATTEMPTS`, the IP is inserted
 * into `BannedIp` and blocked by `ipGuardMiddleware` from then on.
 */
export async function recordFailedAdminAttempt(ip: string): Promise<void> {
  const currentCount = (failedAttemptCounts.get(ip) ?? 0) + 1;
  failedAttemptCounts.set(ip, currentCount);

  if (currentCount >= env.ADMIN_MAX_FAILED_ATTEMPTS) {
    await prisma.bannedIp.upsert({
      where: { ip_address: ip },
      update: {},
      create: {
        ip_address: ip,
        reason: "Exceeded maximum failed admin login attempts",
        attempts: currentCount,
      },
    });
    failedAttemptCounts.delete(ip);
  }
}

export function clearFailedAdminAttempts(ip: string): void {
  failedAttemptCounts.delete(ip);
}
