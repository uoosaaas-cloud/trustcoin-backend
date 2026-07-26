import { NextFunction, Request, Response } from "express";
import { ApiError } from "../utils/apiError";

/** Restricts a route to authenticated users with the ADMIN role. Must run after `authMiddleware`. */
export function adminOnlyMiddleware(req: Request, _res: Response, next: NextFunction): void {
  if (!req.user) {
    throw ApiError.unauthorized();
  }

  if (req.user.role !== "ADMIN") {
    throw ApiError.forbidden();
  }

  next();
}
