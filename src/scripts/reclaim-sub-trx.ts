/**
 * Reclaim leftover TRX from deposit sub-wallets back to the bandwidth funder.
 *
 * Usage:
 *   npx ts-node src/scripts/reclaim-sub-trx.ts
 *   npx ts-node src/scripts/reclaim-sub-trx.ts --address=Txxx...
 */
import dotenv from "dotenv";

dotenv.config();

import { prisma } from "../config/prisma";
import { decryptSecret } from "../utils/secretCipher";
import { reclaimSubWalletTrxToFunder, getTronUsdtBalance } from "../utils/chain/tronUsdt";
import { safeErrorMessage } from "../utils/chain/common";

function parseAddressArg(argv: string[]): string | undefined {
  for (const arg of argv) {
    if (arg.startsWith("--address=")) return arg.slice("--address=".length).trim();
  }
  return undefined;
}

async function main() {
  const filterAddress = parseAddressArg(process.argv.slice(2));
  const rows = await prisma.userDepositAddress.findMany({
    where: {
      network: "TRC20",
      ...(filterAddress ? { address: filterAddress } : {}),
    },
    select: {
      id: true,
      address: true,
      encrypted_private_key: true,
    },
  });

  if (rows.length === 0) {
    console.log(filterAddress ? `No TRC20 deposit address: ${filterAddress}` : "No TRC20 deposit addresses.");
    return;
  }

  for (const row of rows) {
    try {
      const usdt = await getTronUsdtBalance(row.address);
      const key = decryptSecret(row.encrypted_private_key);
      const txid = await reclaimSubWalletTrxToFunder(key, row.address);
      console.log(
        `[reclaim] ${row.address} USDT=${usdt.human} → ${txid ? `reclaimed tx=${txid}` : "nothing to reclaim (below min)"}`
      );
    } catch (error) {
      console.warn(`[reclaim] ${row.address} failed: ${safeErrorMessage(error)}`);
    }
  }
}

main()
  .catch((error) => {
    console.error(safeErrorMessage(error));
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
