import cron, { ScheduledTask } from "node-cron";
import { prisma } from "../config/prisma";
import { env, isProduction } from "../config/env";
import { calculateDailyProfit, toDecimalString } from "../utils/money";
import { distributeDailyProfit } from "../services/investment.service";

export interface DailyRoiRunOptions {
  /** When set, only this investment is processed. */
  investmentId?: string;
  /** Preview payouts without writing to the database. */
  dryRun?: boolean;
}

export interface DailyRoiPreviewItem {
  investmentId: string;
  userId: string;
  packageName: string;
  currentAmount: string;
  dailyProfitPercent: string;
  dailyProfit: string;
  matured: boolean;
  principalReturn: string | null;
}

export interface DailyRoiRunSummary {
  mode: "live" | "dry-run";
  processed: number;
  failed: number;
  previews?: DailyRoiPreviewItem[];
}

/** In-process mutex so overlapping cron ticks never double-pay. */
let isRunning = false;

/**
 * Runs one daily-ROI distribution pass over ACTIVE investments.
 * Profit is computed on each investment's `current_amount` (idempotent per UTC day).
 */

export async function runDailyRoiDistribution(
  options: DailyRoiRunOptions = {}
): Promise<DailyRoiRunSummary> {
  const { investmentId, dryRun = false } = options;

  if (!dryRun && isRunning) {
    // eslint-disable-next-line no-console
    console.warn("[dailyRoiJob] Already in progress — skipping overlapping run.");
    return { mode: "live", processed: 0, failed: 0 };
  }

  if (!dryRun) isRunning = true;

  try {
    return await executeDailyRoiDistribution(options);
  } finally {
    if (!dryRun) isRunning = false;
  }
}

async function executeDailyRoiDistribution(
  options: DailyRoiRunOptions = {}
): Promise<DailyRoiRunSummary> {
  const { investmentId, dryRun = false } = options;

  const activeInvestments = await prisma.investment.findMany({
    where: {
      status: "ACTIVE",
      ...(investmentId ? { id: investmentId } : {}),
    },
    include: {
      package: { select: { name: true } },
    },
  });

  if (investmentId && activeInvestments.length === 0) {
    throw new Error(`No ACTIVE investment found with id ${investmentId}.`);
  }

  if (dryRun) {
    const previews: DailyRoiPreviewItem[] = activeInvestments.map((investment) => {
      const dailyProfit = calculateDailyProfit(
        investment.current_amount.toString(),
        investment.daily_profit_percent.toString()
      );
      const matured = new Date() >= investment.end_date;

      return {
        investmentId: investment.id,
        userId: investment.user_id,
        packageName: investment.package.name,
        currentAmount: toDecimalString(investment.current_amount.toString()),
        dailyProfitPercent: toDecimalString(investment.daily_profit_percent.toString()),
        dailyProfit,
        matured,
        principalReturn: matured ? toDecimalString(investment.current_amount.toString()) : null,
      };
    });

    return {
      mode: "dry-run",
      processed: previews.length,
      failed: 0,
      previews,
    };
  }

  let processed = 0;
  let failed = 0;

  for (const { id } of activeInvestments) {
    try {
      await distributeDailyProfit(id);
      processed += 1;
    } catch (error) {
      failed += 1;
      // eslint-disable-next-line no-console
      console.error(`[dailyRoiJob] Failed to distribute profit for investment ${id}:`, error);
    }
  }

  // eslint-disable-next-line no-console
  console.log(`[dailyRoiJob] Daily ROI distribution complete. Processed: ${processed}, Failed: ${failed}.`);

  return { mode: "live", processed, failed };
}

let scheduledTask: ScheduledTask | null = null;

/** Schedules the daily ROI distribution job per `DAILY_ROI_CRON_SCHEDULE` (default: every day at 00:00). */
export function startDailyRoiJob(): ScheduledTask {
  if (scheduledTask) {
    return scheduledTask;
  }

  scheduledTask = cron.schedule(env.DAILY_ROI_CRON_SCHEDULE, () => {
    runDailyRoiDistribution().catch((error) => {
      // eslint-disable-next-line no-console
      console.error("[dailyRoiJob] Unexpected error during scheduled run:", error);
    });
  });

  if (!isProduction) {
    // eslint-disable-next-line no-console
    console.log(`[dailyRoiJob] Scheduled with cron expression "${env.DAILY_ROI_CRON_SCHEDULE}".`);
  }

  return scheduledTask;
}

export function stopDailyRoiJob(): void {
  scheduledTask?.stop();
  scheduledTask = null;
}
