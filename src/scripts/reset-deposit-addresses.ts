/**
 * Wipe per-user deposit addresses after rotating DEPOSIT_HD_MNEMONIC.
 *
 * Keeps ledger history (deposit_requests, transactions, user balances).
 * Deletes user_deposit_addresses (cascades deposit_sweeps) and clears
 * deposit_requests.deposit_address_id.
 *
 *   npm run deposit:reset-addresses
 *   npm run deposit:reset-addresses -- --yes
 */
import dotenv from "dotenv";

dotenv.config();

import { prisma } from "../config/prisma";

async function main() {
  const confirmed = process.argv.includes("--yes");
  if (!confirmed) {
    // eslint-disable-next-line no-console
    console.log(
      JSON.stringify(
        {
          action: "reset-deposit-addresses",
          warning:
            "This deletes all user_deposit_addresses and deposit_sweeps, " +
            "and nulls deposit_requests.deposit_address_id. Ledger balances are kept.",
          nextStep: "Re-run with --yes to execute.",
        },
        null,
        2
      )
    );
    process.exitCode = 1;
    return;
  }

  const sweeps = await prisma.depositSweep.deleteMany({});
  const addresses = await prisma.userDepositAddress.deleteMany({});
  const claims = await prisma.depositRequest.updateMany({
    where: { deposit_address_id: { not: null } },
    data: { deposit_address_id: null, sweep_tx_hash: null },
  });

  // eslint-disable-next-line no-console
  console.log(
    JSON.stringify(
      {
        ok: true,
        deletedSweeps: sweeps.count,
        deletedAddresses: addresses.count,
        clearedClaimLinks: claims.count,
        note: "Next /deposit/address call will derive fresh addresses from DEPOSIT_HD_MNEMONIC.",
      },
      null,
      2
    )
  );
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
