/**
 * One-shot: upsert an ADMIN account from ADMIN_EMAIL / ADMIN_PASSWORD env vars.
 *
 * Usage:
 *   ADMIN_EMAIL=... ADMIN_PASSWORD=... npx ts-node src/scripts/upsert-admin.ts
 */
import dotenv from "dotenv";

dotenv.config();

import { prisma } from "../config/prisma";
import { ensureAdminFromEnv } from "../services/adminBootstrap.service";

async function main() {
  const email = (process.env.ADMIN_EMAIL || "").trim().toLowerCase();
  const password = process.env.ADMIN_PASSWORD || "";

  if (!email || !password) {
    throw new Error("ADMIN_EMAIL and ADMIN_PASSWORD env vars are required.");
  }

  const result = await ensureAdminFromEnv();
  // eslint-disable-next-line no-console
  console.log(JSON.stringify({ action: result.action }));
}

main()
  .catch((error) => {
    // eslint-disable-next-line no-console
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
