import { createApp } from "./app";
import { env } from "./config/env";
import { prisma } from "./config/prisma";
import { startDailyRoiJob, stopDailyRoiJob } from "./jobs/dailyRoi.job";
import { startDepositSweepJob, stopDepositSweepJob } from "./jobs/depositSweep.job";

const app = createApp();

const server = app.listen(env.PORT, () => {
  // eslint-disable-next-line no-console
  console.log(`TrustCoin API listening on port ${env.PORT} [${env.NODE_ENV}]`);
});

startDailyRoiJob();
startDepositSweepJob();

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
