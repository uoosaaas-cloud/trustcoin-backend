import { NextFunction, Request, Response } from "express";
import { ZodSchema } from "zod";
import { ApiError } from "../utils/apiError";

/** Validates `req.body` against a Zod schema and replaces it with the parsed, typed result. */
export function validateBody(schema: ZodSchema) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    const result = schema.safeParse(req.body);

    if (!result.success) {
      const flattened = result.error.flatten();
      const fieldMessages = Object.entries(flattened.fieldErrors)
        .flatMap(([field, messages]) => (messages ?? []).map((message) => `${field}: ${message}`));
      // eslint-disable-next-line no-console
      console.warn(`[validate] ${req.method} ${req.originalUrl} failed:`, fieldMessages);
      throw ApiError.badRequest("errors.validation_failed", {
        ...flattened,
        summary: fieldMessages.join("; ") || flattened.formErrors.join("; "),
      });
    }

    req.body = result.data;
    next();
  };
}

/** Validates `req.query` against a Zod schema and replaces it with the parsed, typed result. */
export function validateQuery(schema: ZodSchema) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    const result = schema.safeParse(req.query);

    if (!result.success) {
      const flattened = result.error.flatten();
      const fieldMessages = Object.entries(flattened.fieldErrors)
        .flatMap(([field, messages]) => (messages ?? []).map((message) => `${field}: ${message}`));
      // eslint-disable-next-line no-console
      console.warn(`[validate] ${req.method} ${req.originalUrl} failed:`, fieldMessages);
      throw ApiError.badRequest("errors.validation_failed", {
        ...flattened,
        summary: fieldMessages.join("; ") || flattened.formErrors.join("; "),
      });
    }

    req.query = result.data;
    next();
  };
}
