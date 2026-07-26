import express, { Application } from "express";
import cors from "cors";
import helmet from "helmet";
import morgan from "morgan";
import { env, isProduction } from "./config/env";
import { i18nMiddleware } from "./middlewares/i18n.middleware";
import { globalRateLimiter } from "./middlewares/rateLimiter.middleware";
import { errorHandler, notFoundHandler } from "./middlewares/errorHandler.middleware";
import { UPLOADS_ROOT } from "./utils/upload";
import routes from "./routes";

export function createApp(): Application {
  const app = express();

  app.disable("x-powered-by");

  // Required behind Nginx/Cloudflare so rate-limit + IP bans see the real client IP.
  if (env.TRUST_PROXY) {
    app.set("trust proxy", 1);
  }

  // Deposit proof screenshots (and any other uploads) are static assets
  // served under /uploads — served before helmet's default CSP would apply
  // so images embed cleanly when the frontend renders them directly.
  app.use(
    "/uploads",
    helmet({ crossOriginResourcePolicy: { policy: "cross-origin" } }),
    express.static(UPLOADS_ROOT)
  );
  app.use(helmet());

  // In production never use bare "*" with credentials — fall back to APP_BASE_URL.
  const corsOrigin =
    env.CORS_ORIGIN === "*"
      ? isProduction
        ? env.APP_BASE_URL
        : true
      : env.CORS_ORIGIN.split(",").map((value) => value.trim()).filter(Boolean);

  app.use(cors({ origin: corsOrigin, credentials: true }));
  app.use(express.json({ limit: "1mb" }));
  app.use(express.urlencoded({ extended: true }));
  app.use(morgan(isProduction ? "combined" : "dev"));
  app.use(i18nMiddleware);
  app.use(globalRateLimiter);

  app.use("/api/v1", routes);

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
