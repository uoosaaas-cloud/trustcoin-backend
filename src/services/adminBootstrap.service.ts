import { prisma } from "../config/prisma";
import { comparePassword, hashPassword } from "../utils/password";
import { generateUniqueReferralCode } from "../utils/referral";

export type AdminBootstrapResult = { action: "skipped" | "created" | "updated" };

/**
 * Sync the ADMIN account from ADMIN_EMAIL / ADMIN_PASSWORD env vars.
 * Never logs the password. Skips when credentials already match.
 */
export async function ensureAdminFromEnv(): Promise<AdminBootstrapResult> {
  const email = (process.env.ADMIN_EMAIL || "").trim().toLowerCase();
  const password = process.env.ADMIN_PASSWORD || "";

  if (!email || !password) {
    return { action: "skipped" };
  }

  const existing = await prisma.user.findUnique({
    where: { email },
    select: { id: true, role: true, password_hash: true, is_verified: true, status: true },
  });

  if (existing) {
    const passwordMatches = await comparePassword(password, existing.password_hash);
    const alreadyAdmin =
      existing.role === "ADMIN" && existing.is_verified && existing.status === "ACTIVE";
    if (passwordMatches && alreadyAdmin) {
      return { action: "skipped" };
    }

    const passwordHash = passwordMatches ? existing.password_hash : await hashPassword(password);
    await prisma.user.update({
      where: { id: existing.id },
      data: {
        role: "ADMIN",
        password_hash: passwordHash,
        is_verified: true,
        status: "ACTIVE",
      },
    });
    return { action: "updated" };
  }

  const referralCode = await generateUniqueReferralCode();
  await prisma.user.create({
    data: {
      email,
      password_hash: await hashPassword(password),
      role: "ADMIN",
      is_verified: true,
      status: "ACTIVE",
      language: "en",
      referral_code: referralCode,
    },
  });
  return { action: "created" };
}
