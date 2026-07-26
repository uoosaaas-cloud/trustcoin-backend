import { NextFunction, Request, Response } from "express";
import { env } from "../config/env";
import { isSupportedLanguage } from "../utils/i18n";

/**
 * Resolves the active language for the request in this priority:
 * 1. `lang` query param, 2. `x-lang` header, 3. authenticated user's saved
 * language preference, 4. platform default (EN).
 */
export function i18nMiddleware(req: Request, _res: Response, next: NextFunction): void {
  const queryLang = typeof req.query.lang === "string" ? req.query.lang : undefined;
  const headerLang = req.headers["x-lang"];
  const userLang = req.user?.language;

  const candidate = queryLang ?? (typeof headerLang === "string" ? headerLang : undefined) ?? userLang;

  req.lang = candidate && isSupportedLanguage(candidate) ? candidate : env.DEFAULT_LANGUAGE;
  next();
}
