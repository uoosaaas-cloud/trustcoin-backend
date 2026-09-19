import cron, { type ScheduledTask } from "node-cron";
import { env, isProduction } from "../config/env";
import { publishDueAutoTrades } from "../services/autoTrade.service";

let scheduledTask: ScheduledTask | null = null;
let catchupTask: ScheduledTask | null = null;
const CRON_TIMEZONE = "UTC";

export async function runAutoTradePublish(): Promise<void> {
  const summary = await publishDueAutoTrades();
  // eslint-disable-next-line no-console
  console.log(
    `[autoTradeJob] skipped=${summary.skipped}${
      summary.reason ? ` reason=${summary.reason}` : ""
    } published=${summary.published} alreadyPresent=${summary.alreadyPresent}`
  );
}

function schedulePublish(expression: string, label: string): ScheduledTask {
  return cron.schedule(
    expression,
    () => {
      runAutoTradePublish().catch((error) => {
        // eslint-disable-next-line no-console
        console.error(`[autoTradeJob] Unexpected error during ${label}:`, error);
      });
    },
    { timezone: CRON_TIMEZONE }
  );
}

export function startAutoTradeJob(): ScheduledTask | null {
  if (!env.AUTO_TRADES_ENABLED) {
    // eslint-disable-next-line no-console
    console.log("[autoTradeJob] Disabled (AUTO_TRADES_ENABLED=false).");
    return null;
  }

  if (!scheduledTask) {
    scheduledTask = schedulePublish(env.AUTO_TRADES_CRON_SCHEDULE, "scheduled run");
  }

  if (!catchupTask) {
    catchupTask = schedulePublish(env.AUTO_TRADES_CATCHUP_CRON_SCHEDULE, "hourly catch-up");
  }

  if (!isProduction) {
    // eslint-disable-next-line no-console
    console.log(
      `[autoTradeJob] Scheduled "${env.AUTO_TRADES_CRON_SCHEDULE}" UTC + catch-up "${env.AUTO_TRADES_CATCHUP_CRON_SCHEDULE}" UTC.`
    );
  }

  return scheduledTask;
}

export function stopAutoTradeJob(): void {
  scheduledTask?.stop();
  catchupTask?.stop();
  scheduledTask = null;
  catchupTask = null;
}
