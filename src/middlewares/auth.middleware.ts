import { NextFunction, Request, Response } from "express";
import { prisma } from "../config/prisma";
import { ApiError } from "../utils/apiError";
import { asyncHandler } from "../utils/asyncHandler";
import { verifyToken } from "../utils/jwt";

/** Verifies the Bearer JWT and attaches the authenticated user to `req.user`. */
export const authMiddleware = asyncHandler(async (req: Request, _res: Response, next: NextFunction) => {
  const header = req.headers.authorization;

  if (!header || !header.startsWith("Bearer ")) {
    throw ApiError.unauthorized();
  }

  const token = header.slice("Bearer ".length);

  let payload;
  try {
    payload = verifyToken(token);
  } catch {
    throw ApiError.unauthorized();
  }

  const user = await prisma.user.findUnique({ where: { id: payload.userId } });

  if (!user) {
    throw ApiError.unauthorized();
  }

  if (user.status === "PENDING") {
    throw ApiError.forbidden("auth.account_pending");
  }

  if (user.status !== "ACTIVE") {
    throw ApiError.forbidden("auth.account_suspended");
  }

  req.user = { id: user.id, email: user.email, role: user.role, language: user.language };
  next();
});
