import { PrismaClient } from "@prisma/client";
import { isProduction } from "./env";

// Reuse a single PrismaClient instance across hot-reloads in development
// to avoid exhausting the database connection pool.
declare global {
  // eslint-disable-next-line no-var
  var __prisma: PrismaClient | undefined;
}

export const prisma =
  global.__prisma ??
  new PrismaClient({
    log: isProduction ? ["error", "warn"] : ["query", "error", "warn"],
  });

if (!isProduction) {
  global.__prisma = prisma;
}
