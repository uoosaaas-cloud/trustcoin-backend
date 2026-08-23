import cron, { type ScheduledTask } from "node-cron";
import { env, isProduction } from "../config/env";
import { publishDueAutoTrades } from "../services/autoTrade.service";

let scheduledTask: ScheduledTask | null = null;

export async function runAutoTradePublish(): Promise<void> {
  const summary = await publishDueAutoTrades();
  if (!isProduction && !summary.skipped) {
    // eslint-disable-next-line no-console
    console.log(
      `[autoTradeJob] Published ${summary.published} auto trade(s); already present: ${summary.alreadyPresent}.`
    );
  }
}

export function startAutoTradeJob(): ScheduledTask | null {
  if (!env.AUTO_TRADES_ENABLED) {
    if (!isProduction) {
      // eslint-disable-next-line no-console
      console.log("[autoTradeJob] Disabled (AUTO_TRADES_ENABLED=false).");
    }
    return null;
  }

  if (scheduledTask) {
    return scheduledTask;
  }

  scheduledTask = cron.schedule(env.AUTO_TRADES_CRON_SCHEDULE, () => {
    runAutoTradePublish().catch((error) => {
      // eslint-disable-next-line no-console
      console.error("[autoTradeJob] Unexpected error during scheduled run:", error);
    });
  });

  if (!isProduction) {
    // eslint-disable-next-line no-console
    console.log(`[autoTradeJob] Scheduled with cron expression "${env.AUTO_TRADES_CRON_SCHEDULE}".`);
  }

  return scheduledTask;
}

export function stopAutoTradeJob(): void {
  scheduledTask?.stop();
  scheduledTask = null;
}
