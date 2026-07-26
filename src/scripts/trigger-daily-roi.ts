/**
 * CLI entrypoint for a one-shot daily ROI payout run.
 *
 * Usage:
 *   npx ts-node src/scripts/trigger-daily-roi.ts
 *   npx ts-node src/scripts/trigger-daily-roi.ts --dry-run
 *   npx ts-node src/scripts/trigger-daily-roi.ts --investment-id=<uuid>
 */
import dotenv from "dotenv";

dotenv.config();

import { prisma } from "../config/prisma";
import { runDailyRoiDistribution } from "../jobs/dailyRoi.job";
import { safeErrorMessage } from "../utils/chain/common";

function parseArgs(argv: string[]) {
  let dryRun = false;
  let investmentId: string | undefined;

  for (const arg of argv) {
    if (arg === "--dry-run") {
      dryRun = true;
      continue;
    }
    if (arg.startsWith("--investment-id=")) {
      investmentId = arg.slice("--investment-id=".length);
      continue;
    }
    if (arg === "--help" || arg === "-h") {
      // eslint-disable-next-line no-console
      console.log(
        "Usage: ts-node src/scripts/trigger-daily-roi.ts [--dry-run] [--investment-id=<uuid>]"
      );
      process.exit(0);
    }
  }

  return { dryRun, investmentId };
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  // eslint-disable-next-line no-console
  console.log("[trigger-daily-roi] Starting with options:", options);

  const summary = await runDailyRoiDistribution(options);
  // eslint-disable-next-line no-console
  console.log(JSON.stringify(summary, null, 2));
}

main()
  .catch((error) => {
    // eslint-disable-next-line no-console
    console.error(`[trigger-daily-roi] Failed: ${safeErrorMessage(error)}`);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
