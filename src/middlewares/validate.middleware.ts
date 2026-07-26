import { NextFunction, Request, Response } from "express";
import { ZodSchema } from "zod";
import { ApiError } from "../utils/apiError";

/** Validates `req.body` against a Zod schema and replaces it with the parsed, typed result. */
export function validateBody(schema: ZodSchema) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    const result = schema.safeParse(req.body);

    if (!result.success) {
      throw ApiError.badRequest("errors.validation_failed", result.error.flatten());
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
      throw ApiError.badRequest("errors.validation_failed", result.error.flatten());
    }

    req.query = result.data;
    next();
  };
}
