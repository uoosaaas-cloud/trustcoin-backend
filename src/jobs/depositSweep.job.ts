import cron, { type ScheduledTask } from "node-cron";
import { env, isProduction } from "../config/env";
import { runDepositSweep } from "../services/sweep.service";
import { safeErrorMessage } from "../utils/chain/common";

let scheduledTask: ScheduledTask | null = null;
/** In-process mutex so overlapping cron ticks never run two sweeps at once. */
let isRunning = false;

/**
 * Executes one full sweep pass over every user deposit address.
 * Safe to call from the cron job, the admin trigger endpoint, or the CLI.
 */
export async function runDepositSweepJob(options?: {
  depositAddressId?: string;
  address?: string;
  network?: "TRC20" | "BEP20" | "ERC20";
  dryRun?: boolean;
  force?: boolean;
}) {
  if (isRunning) {
    // eslint-disable-next-line no-console
    console.warn("[depositSweepJob] Sweep already in progress — skipping overlapping run.");
    return {
      scanned: 0,
      swept: 0,
      skipped: 0,
      failed: 0,
      dryRun: options?.dryRun === true,
      masterWallets: {},
      results: [],
      skippedBecauseBusy: true as const,
    };
  }

  isRunning = true;
  try {
    return await runDepositSweep(options);
  } finally {
    isRunning = false;
  }
}

/** Schedules the deposit sweep worker per `DEPOSIT_SWEEP_CRON_SCHEDULE`. */
export function startDepositSweepJob(): ScheduledTask | null {
  if (!env.DEPOSIT_SWEEP_ENABLED) {
    if (!isProduction) {
      // eslint-disable-next-line no-console
      console.log(
        `[depositSweepJob] Disabled (DEPOSIT_SWEEP_ENABLED=false). Manual trigger via admin/CLI still works.`
      );
    }
    return null;
  }

  if (scheduledTask) {
    return scheduledTask;
  }

  scheduledTask = cron.schedule(env.DEPOSIT_SWEEP_CRON_SCHEDULE, () => {
    runDepositSweepJob().catch((error) => {
      // eslint-disable-next-line no-console
      console.error(`[depositSweepJob] Unexpected error during scheduled run: ${safeErrorMessage(error)}`);
    });
  });

  if (!isProduction) {
    // eslint-disable-next-line no-console
    console.log(`[depositSweepJob] Scheduled with cron expression "${env.DEPOSIT_SWEEP_CRON_SCHEDULE}".`);
  }

  return scheduledTask;
}

export function stopDepositSweepJob(): void {
  scheduledTask?.stop();
  scheduledTask = null;
}
