/**
 * CLI entrypoint for a one-shot deposit sweep.
 *
 * Usage:
 *   npx ts-node src/scripts/trigger-sweep.ts
 *   npx ts-node src/scripts/trigger-sweep.ts --dry-run
 *   npx ts-node src/scripts/trigger-sweep.ts --network=TRC20
 *   npx ts-node src/scripts/trigger-sweep.ts --address-id=<uuid>
 *   npx ts-node src/scripts/trigger-sweep.ts --address=TXxx... --network=TRC20
 *   npx ts-node src/scripts/trigger-sweep.ts --address=TXxx... --force
 */
// Load `.env` before any other local imports so TRON_GRID_API_KEY /
// TRON_FULL_HOST are available when `src/config/env.ts` is evaluated.
import dotenv from "dotenv";

dotenv.config();

import { prisma } from "../config/prisma";
import { env } from "../config/env";
import { runDepositSweepJob } from "../jobs/depositSweep.job";
import { DEPOSIT_NETWORKS, type DepositNetwork } from "../validators/deposit.validator";
import { safeErrorMessage } from "../utils/chain/common";

function parseArgs(argv: string[]) {
  let dryRun = false;
  let force = false;
  let network: DepositNetwork | undefined;
  let depositAddressId: string | undefined;
  let address: string | undefined;

  for (const arg of argv) {
    if (arg === "--dry-run") {
      dryRun = true;
      continue;
    }
    if (arg === "--force") {
      force = true;
      continue;
    }
    if (arg.startsWith("--network=")) {
      const value = arg.slice("--network=".length).toUpperCase();
      if (!(DEPOSIT_NETWORKS as readonly string[]).includes(value)) {
        throw new Error(`Invalid --network=${value}. Expected one of ${DEPOSIT_NETWORKS.join(", ")}.`);
      }
      network = value as DepositNetwork;
      continue;
    }
    if (arg.startsWith("--address-id=")) {
      depositAddressId = arg.slice("--address-id=".length);
      continue;
    }
    if (arg.startsWith("--address=")) {
      address = arg.slice("--address=".length).trim();
      continue;
    }
    if (arg === "--help" || arg === "-h") {
      // eslint-disable-next-line no-console
      console.log(
        "Usage: ts-node src/scripts/trigger-sweep.ts [--dry-run] [--force] [--network=TRC20|BEP20|ERC20] [--address-id=<uuid>] [--address=<on-chain-address>]"
      );
      process.exit(0);
    }
  }

  return { dryRun, force, network, depositAddressId, address };
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  // eslint-disable-next-line no-console
  console.log("[trigger-sweep] Starting sweep with options:", options);
  // eslint-disable-next-line no-console
  console.log(
    `[trigger-sweep] Tron primary=${env.TRON_FULL_HOST} fallback=${env.TRON_FALLBACK_HOST} apiKey=${
      env.TRON_API_KEY ? "configured" : "missing"
    } | Feee energy=${env.TRON_ENERGY_API_KEY ? "configured" : "MISSING"} require=${env.TRON_ENERGY_REQUIRE}` +
      ` | Bandwidth funder=${env.TRON_BANDWIDTH_FUNDER_PRIVATE_KEY || env.TRON_BANDWIDTH_FUNDER_MNEMONIC ? "configured" : "MISSING"} ` +
      `topup=${env.TRON_BANDWIDTH_TRX_TOPUP}TRX reclaimMin=${env.TRON_BANDWIDTH_RECLAIM_MIN_TRX}TRX`
  );

  const summary = await runDepositSweepJob(options);
  // eslint-disable-next-line no-console
  console.log(JSON.stringify(summary, null, 2));
}

main()
  .catch((error) => {
    // eslint-disable-next-line no-console
    console.error(`[trigger-sweep] Failed: ${safeErrorMessage(error)}`);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
