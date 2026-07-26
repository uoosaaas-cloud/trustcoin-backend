import { NextFunction, Request, Response } from "express";
import { Prisma } from "@prisma/client";
import multer from "multer";
import { ApiError } from "../utils/apiError";
import { sendError } from "../utils/apiResponse";
import { translate } from "../utils/i18n";

export function notFoundHandler(req: Request, res: Response): void {
  sendError(res, 404, translate("errors.not_found", req.lang));
}

/**
 * Prisma errors never carry a translated, user-safe message — they leak raw
 * SQL/connection details that must not reach the client. This maps the
 * common cases to a clear status code + translated message, and always logs
 * the raw error server-side (regardless of env) so a failure is never
 * silently swallowed into an unhelpful generic 500.
 */
function handlePrismaError(error: unknown, lang: string, res: Response): boolean {
  // Database is unreachable, refused the connection, or auth/config is wrong
  // (e.g. MAMP/MySQL not running, wrong DATABASE_URL credentials, DB dropped).
  if (error instanceof Prisma.PrismaClientInitializationError) {
    console.error("[db] Prisma failed to initialize/connect:", error.message);
    sendError(res, 503, translate("errors.database_unavailable", lang));
    return true;
  }

  // The connection pool dropped mid-request (e.g. MySQL restarted, timeout).
  if (error instanceof Prisma.PrismaClientRustPanicError) {
    console.error("[db] Prisma engine panicked:", error.message);
    sendError(res, 503, translate("errors.database_unavailable", lang));
    return true;
  }

  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    console.error(`[db] Prisma known request error (${error.code}):`, error.message, error.meta);

    switch (error.code) {
      // Unique constraint violation (e.g. duplicate email/referral_code).
      case "P2002":
        sendError(res, 409, translate("errors.validation_failed", lang), { fields: error.meta?.target });
        return true;
      // Foreign key constraint failed (e.g. referencing a package/user that no longer exists).
      case "P2003":
        sendError(res, 400, translate("errors.validation_failed", lang), { field: error.meta?.field_name });
        return true;
      // Record required for the operation (e.g. update/delete by id) was not found.
      case "P2025":
        sendError(res, 404, translate("errors.not_found", lang));
        return true;
      // Could not reach the database server at all.
      case "P1001":
      case "P1002":
      case "P1003":
        sendError(res, 503, translate("errors.database_unavailable", lang));
        return true;
      default:
        sendError(res, 500, translate("errors.internal_server_error", lang));
        return true;
    }
  }

  // Query built with the wrong shape/types for the current schema — usually
  // means the Prisma Client is stale relative to `schema.prisma` (run
  // `npx prisma generate` after every schema change) or the migration wasn't
  // applied to the database.
  if (error instanceof Prisma.PrismaClientValidationError) {
    console.error("[db] Prisma client validation error (client may be out of sync with schema.prisma):", error.message);
    sendError(res, 500, translate("errors.internal_server_error", lang));
    return true;
  }

  return false;
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function errorHandler(error: unknown, req: Request, res: Response, _next: NextFunction): void {
  const lang = req.lang;

  if (error instanceof ApiError) {
    sendError(res, error.statusCode, translate(error.messageKey, lang, error.params), error.details, error.messageKey);
    return;
  }

  // File upload rejected by multer (e.g. proof image over the size limit).
  if (error instanceof multer.MulterError) {
    const messageKey = error.code === "LIMIT_FILE_SIZE" ? "errors.file_too_large" : "errors.validation_failed";
    sendError(res, 400, translate(messageKey, lang), { code: error.code, field: error.field });
    return;
  }

  if (handlePrismaError(error, lang, res)) {
    return;
  }

  // Always log unexpected errors server-side — even in production — so a
  // generic 500 shown to the user never means the real cause is lost.
  console.error(error);

  sendError(res, 500, translate("errors.internal_server_error", lang));
}
