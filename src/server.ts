import { createApp } from "./app";
import { env } from "./config/env";
import { prisma } from "./config/prisma";
import { runDailyRoiDistribution, startDailyRoiJob, stopDailyRoiJob } from "./jobs/dailyRoi.job";
import { startDepositSweepJob, stopDepositSweepJob } from "./jobs/depositSweep.job";

const app = createApp();

const server = app.listen(env.PORT, () => {
  // eslint-disable-next-line no-console
  console.log(`TrustCoin API listening on port ${env.PORT} [${env.NODE_ENV}]`);
});

startDailyRoiJob();
startDepositSweepJob();

// Catch up missed daily profits / matured principal unlocks after deploys or
// sleeping dynos (in-process cron alone is not enough on free/sleeping hosts).
runDailyRoiDistribution()
  .then((summary) => {
    // eslint-disable-next-line no-console
    console.log(
      `[startup] ROI catch-up complete. Processed: ${summary.processed}, Failed: ${summary.failed}.`
    );
  })
  .catch((error) => {
    // eslint-disable-next-line no-console
    console.error("[startup] ROI catch-up failed:", error);
  });

async function shutdown(signal: string) {
  // eslint-disable-next-line no-console
  console.log(`Received ${signal}, shutting down gracefully...`);
  stopDailyRoiJob();
  stopDepositSweepJob();
  server.close(async () => {
    await prisma.$disconnect();
    process.exit(0);
  });
}

process.on("SIGINT", () => shutdown("SIGINT"));
process.on("SIGTERM", () => shutdown("SIGTERM"));
