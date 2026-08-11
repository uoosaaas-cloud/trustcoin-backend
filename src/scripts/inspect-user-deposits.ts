/**
 * Read-only inspection of a user's deposits / balance-related transactions.
 *
 * Usage:
 *   npx ts-node src/scripts/inspect-user-deposits.ts --email=user@example.com
 */
import dotenv from "dotenv";

dotenv.config();

import { prisma } from "../config/prisma";

async function main() {
  const emailArg = process.argv.find((a) => a.startsWith("--email="));
  const email = emailArg?.slice("--email=".length) ?? "baraaosamaa45@gmail.com";

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

  console.log("USER", user);
  if (!user) return;

  const addresses = await prisma.userDepositAddress.findMany({
    where: { user_id: user.id },
    orderBy: { created_at: "desc" },
  });
  console.log(
    "ADDRESSES",
    addresses.map((a) => ({
      id: a.id,
      network: a.network,
      address: a.address,
      lastSweep: a.last_sweep_status,
      lastSweepHash: a.last_sweep_tx_hash,
      lastSweptAt: a.last_swept_at?.toISOString() ?? null,
      created: a.created_at.toISOString(),
    }))
  );

  const txs = await prisma.transaction.findMany({
    where: { user_id: user.id },
    orderBy: { created_at: "asc" },
  });
  console.log("TX_COUNT", txs.length);
  let running = 0;
  for (const t of txs) {
    const amt = Number(t.amount.toString());
    const signed =
      t.type === "WITHDRAWAL" || t.type === "PACKAGE_PURCHASE"
        ? -amt
        : t.type === "DEPOSIT" ||
            t.type === "PROFIT_DISTRIBUTION" ||
            t.type === "PACKAGE_RETURN" ||
            t.type === "REFERRAL_BONUS_ADDED"
          ? amt
          : 0;
    // Only completed credits/debits affect available roughly
    if (t.status === "COMPLETED" || (t.type === "WITHDRAWAL" && t.status === "PENDING")) {
      running += signed;
    }
    console.log({
      type: t.type,
      status: t.status,
      amount: t.amount.toString(),
      network: t.network,
      address: t.payment_address,
      hash: t.tx_hash,
      note: t.note,
      at: t.created_at.toISOString(),
      approxRunning: running.toFixed(4),
    });
  }
  console.log("CURRENT_BALANCE", user.balance.toString(), "APPROX_FROM_TX", running.toFixed(4));

  const depositRequests = await prisma.depositRequest.findMany({
    where: { user_id: user.id },
    orderBy: { created_at: "desc" },
    include: { depositAddress: { select: { address: true } } },
  });
  console.log("DEPOSIT_REQUESTS", depositRequests.length);
  for (const d of depositRequests) {
    console.log({
      id: d.id,
      amount: d.amount.toString(),
      status: d.status,
      network: d.network,
      txHash: d.tx_hash,
      sweepHash: d.sweep_tx_hash,
      address: d.depositAddress?.address ?? null,
      at: d.created_at.toISOString(),
      sweptAt: d.swept_at?.toISOString() ?? null,
    });
  }

  const addressIds = addresses.map((a) => a.id);
  const sweeps =
    addressIds.length === 0
      ? []
      : await prisma.depositSweep.findMany({
          where: { deposit_address_id: { in: addressIds } },
          orderBy: { created_at: "desc" },
          take: 50,
        });
  console.log("SWEEPS", sweeps.length);
  for (const s of sweeps) {
    console.log({
      id: s.id,
      status: s.status,
      amount: s.amount_usdt.toString(),
      network: s.network,
      from: s.from_address,
      to: s.to_address,
      sweepHash: s.sweep_tx_hash,
      error: s.error_message,
      at: s.created_at.toISOString(),
    });
  }

  const adminLogs = await prisma.adminLog.findMany({
    where: { user_id: user.id },
    orderBy: { created_at: "desc" },
    take: 30,
  });
  console.log("ADMIN_LOGS", adminLogs.length);
  for (const l of adminLogs) {
    console.log({
      action: l.action,
      details: l.details,
      at: l.created_at.toISOString(),
    });
  }
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
