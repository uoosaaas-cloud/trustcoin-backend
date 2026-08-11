/**
 * Read-only inspection of a user's wallet + investments (and global overdue ACTIVE).
 *
 * Usage:
 *   npx ts-node src/scripts/inspect-user-packages.ts --email=user@example.com
 */
import dotenv from "dotenv";

dotenv.config();

import { prisma } from "../config/prisma";

async function main() {
  const emailArg = process.argv.find((a) => a.startsWith("--email="));
  const email = emailArg?.slice("--email=".length) ?? "baraaosamaa45@gmail.com";
  const now = new Date();

  const user = await prisma.user.findUnique({
    where: { email },
    select: {
      id: true,
      email: true,
      balance: true,
      pending_referral_bonus: true,
      status: true,
      created_at: true,
    },
  });

  console.log("NOW", now.toISOString());
  console.log("USER", user);

  if (!user) {
    return;
  }

  const investments = await prisma.investment.findMany({
    where: { user_id: user.id },
    include: { package: { select: { name: true, amount: true, duration_days: true } } },
    orderBy: { start_date: "desc" },
  });

  for (const i of investments) {
    const matured = now >= i.end_date;
    console.log({
      id: i.id,
      status: i.status,
      package: i.package.name,
      invested: i.invested_amount.toString(),
      current: i.current_amount.toString(),
      earned: i.total_earned.toString(),
      start: i.start_date.toISOString(),
      end: i.end_date.toISOString(),
      matured,
      overdueDays: matured ? Math.floor((now.getTime() - i.end_date.getTime()) / 86400000) : 0,
    });
  }

  const txs = await prisma.transaction.findMany({
    where: {
      user_id: user.id,
      type: { in: ["PACKAGE_RETURN", "PACKAGE_PURCHASE", "PROFIT_DISTRIBUTION"] },
    },
    orderBy: { created_at: "desc" },
    take: 80,
  });

  for (const t of txs) {
    console.log({
      type: t.type,
      amount: t.amount.toString(),
      status: t.status,
      hash: t.tx_hash,
      at: t.created_at.toISOString(),
    });
  }

  const overdue = await prisma.investment.findMany({
    where: { status: "ACTIVE", end_date: { lt: now } },
    include: {
      user: { select: { email: true } },
      package: { select: { name: true } },
    },
    orderBy: { end_date: "asc" },
  });

  console.log("ALL_OVERDUE_ACTIVE_COUNT", overdue.length);
  for (const i of overdue) {
    console.log({
      id: i.id,
      email: i.user.email,
      package: i.package.name,
      amount: i.current_amount.toString(),
      end: i.end_date.toISOString(),
    });
  }

  const packages = await prisma.package.findMany({
    orderBy: [{ amount: "asc" }, { duration_days: "asc" }],
  });
  console.log(
    "PACKAGES",
    packages.map((p) => ({
      id: p.id,
      name: p.name,
      amount: p.amount.toString(),
      daily: p.daily_profit_percent.toString(),
      days: p.duration_days,
    }))
  );
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
