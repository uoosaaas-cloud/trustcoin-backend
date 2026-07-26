import { Role } from "@prisma/client";

declare global {
  namespace Express {
    interface Request {
      /** Active resolved language for this request ("en" | "ar"). */
      lang: string;
      /** Populated by `authMiddleware` once the JWT has been verified. */
      user?: {
        id: string;
        email: string;
        role: Role;
        language: string;
      };
    }
  }
}

export {};
