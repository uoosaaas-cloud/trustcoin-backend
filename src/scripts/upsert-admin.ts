/**
 * One-shot: upsert an ADMIN account from ADMIN_EMAIL / ADMIN_PASSWORD env vars.
 *
 * Usage:
 *   ADMIN_EMAIL=... ADMIN_PASSWORD=... npx ts-node src/scripts/upsert-admin.ts
 */
import dotenv from "dotenv";

dotenv.config();

import { prisma } from "../config/prisma";
import { hashPassword } from "../utils/password";
import { generateUniqueReferralCode } from "../utils/referral";

async function main() {
  const email = (process.env.ADMIN_EMAIL || "").trim().toLowerCase();
  const password = process.env.ADMIN_PASSWORD || "";

  if (!email || !password) {
    throw new Error("ADMIN_EMAIL and ADMIN_PASSWORD env vars are required.");
  }

  const passwordHash = await hashPassword(password);
  const existing = await prisma.user.findUnique({ where: { email } });

  if (existing) {
    const updated = await prisma.user.update({
      where: { id: existing.id },
      data: {
        role: "ADMIN",
        password_hash: passwordHash,
        is_verified: true,
        status: "ACTIVE",
      },
      select: { id: true, email: true, role: true, is_verified: true },
    });
    // eslint-disable-next-line no-console
    console.log(JSON.stringify({ action: "updated", user: updated }));
    return;
  }

  const referralCode = await generateUniqueReferralCode();
  const created = await prisma.user.create({
    data: {
      email,
      password_hash: passwordHash,
      role: "ADMIN",
      is_verified: true,
      status: "ACTIVE",
      language: "en",
      referral_code: referralCode,
    },
    select: { id: true, email: true, role: true, is_verified: true },
  });

  // eslint-disable-next-line no-console
  console.log(JSON.stringify({ action: "created", user: created }));
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
