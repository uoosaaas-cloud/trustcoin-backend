import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

/**
 * All investment packages available on TrustCoin, grouped by minimum
 * deposit tier. Each tier offers 1 / 3 / 6 month durations with an
 * increasing daily profit percentage as the lock-in period grows.
 */
const packagesData = [
  // Tier $50
  { name: "Plan 50 - 1 Month", amount: 50, daily_profit_percent: 0.5, duration_days: 30 },
  { name: "Plan 50 - 3 Months", amount: 50, daily_profit_percent: 0.5166, duration_days: 90 },
  { name: "Plan 50 - 6 Months", amount: 50, daily_profit_percent: 0.5333, duration_days: 180 },

  // Tier $100
  { name: "Plan 100 - 1 Month", amount: 100, daily_profit_percent: 0.5666, duration_days: 30 },
  { name: "Plan 100 - 3 Months", amount: 100, daily_profit_percent: 0.5833, duration_days: 90 },
  { name: "Plan 100 - 6 Months", amount: 100, daily_profit_percent: 0.6, duration_days: 180 },

  // Tier $150
  { name: "Plan 150 - 1 Month", amount: 150, daily_profit_percent: 0.6, duration_days: 30 },
  { name: "Plan 150 - 3 Months", amount: 150, daily_profit_percent: 0.6166, duration_days: 90 },
  { name: "Plan 150 - 6 Months", amount: 150, daily_profit_percent: 0.6333, duration_days: 180 },

  // Tier $200
  { name: "Plan 200 - 1 Month", amount: 200, daily_profit_percent: 0.6333, duration_days: 30 },
  { name: "Plan 200 - 3 Months", amount: 200, daily_profit_percent: 0.65, duration_days: 90 },
  { name: "Plan 200 - 6 Months", amount: 200, daily_profit_percent: 0.6666, duration_days: 180 },

  // Tier $400
  { name: "Plan 400 - 1 Month", amount: 400, daily_profit_percent: 0.6666, duration_days: 30 },
  { name: "Plan 400 - 3 Months", amount: 400, daily_profit_percent: 0.6833, duration_days: 90 },
  { name: "Plan 400 - 6 Months", amount: 400, daily_profit_percent: 0.7, duration_days: 180 },

  // Tier $700
  { name: "Plan 700 - 1 Month", amount: 700, daily_profit_percent: 0.7, duration_days: 30 },
  { name: "Plan 700 - 3 Months", amount: 700, daily_profit_percent: 0.7166, duration_days: 90 },
  { name: "Plan 700 - 6 Months", amount: 700, daily_profit_percent: 0.7333, duration_days: 180 },

  // Tier $1000
  { name: "Plan 1000 - 1 Month", amount: 1000, daily_profit_percent: 0.7333, duration_days: 30 },
  { name: "Plan 1000 - 3 Months", amount: 1000, daily_profit_percent: 0.75, duration_days: 90 },
  { name: "Plan 1000 - 6 Months", amount: 1000, daily_profit_percent: 0.7666, duration_days: 180 },

  // Tier $2000
  { name: "Plan 2000 - 1 Month", amount: 2000, daily_profit_percent: 0.7666, duration_days: 30 },
  { name: "Plan 2000 - 3 Months", amount: 2000, daily_profit_percent: 0.7833, duration_days: 90 },
  { name: "Plan 2000 - 6 Months", amount: 2000, daily_profit_percent: 0.8, duration_days: 180 },

  // Tier $5000
  { name: "Plan 5000 - 1 Month", amount: 5000, daily_profit_percent: 0.8, duration_days: 30 },
  { name: "Plan 5000 - 3 Months", amount: 5000, daily_profit_percent: 0.8166, duration_days: 90 },
  { name: "Plan 5000 - 6 Months", amount: 5000, daily_profit_percent: 0.8333, duration_days: 180 },

  // Tier $10000
  { name: "Plan 10000 - 1 Month", amount: 10000, daily_profit_percent: 0.8333, duration_days: 30 },
  { name: "Plan 10000 - 3 Months", amount: 10000, daily_profit_percent: 0.85, duration_days: 90 },
  { name: "Plan 10000 - 6 Months", amount: 10000, daily_profit_percent: 0.8666, duration_days: 180 },

  // Tier $30000
  { name: "Plan 30000 - 1 Month", amount: 30000, daily_profit_percent: 0.8666, duration_days: 30 },
  { name: "Plan 30000 - 3 Months", amount: 30000, daily_profit_percent: 0.8833, duration_days: 90 },
  { name: "Plan 30000 - 6 Months", amount: 30000, daily_profit_percent: 0.9, duration_days: 180 },

  // Tier $50000
  { name: "Plan 50000 - 1 Month", amount: 50000, daily_profit_percent: 0.9, duration_days: 30 },
  { name: "Plan 50000 - 3 Months", amount: 50000, daily_profit_percent: 0.9166, duration_days: 90 },
  { name: "Plan 50000 - 6 Months", amount: 50000, daily_profit_percent: 0.9333, duration_days: 180 },

  // Tier $100000
  { name: "Plan 100000 - 1 Month", amount: 100000, daily_profit_percent: 0.9666, duration_days: 30 },
  { name: "Plan 100000 - 3 Months", amount: 100000, daily_profit_percent: 0.9833, duration_days: 90 },
  { name: "Plan 100000 - 6 Months", amount: 100000, daily_profit_percent: 1.0, duration_days: 180 },

  // Tier $200000
  { name: "Plan 200000 - 1 Month", amount: 200000, daily_profit_percent: 1.0833, duration_days: 30 },
  { name: "Plan 200000 - 3 Months", amount: 200000, daily_profit_percent: 1.1, duration_days: 90 },
  { name: "Plan 200000 - 6 Months", amount: 200000, daily_profit_percent: 1.1333, duration_days: 180 },
];

/**
 * Legacy package columns kept for schema compatibility only.
 * Live referral commission is 25% of expected package PROFIT
 * (`src/constants/referrals.ts`) — these fields are NOT used for payouts.
 */
const REFERRAL_BONUS_SCHEDULE = {
  referral_bonus_1m: 25.0,
  referral_bonus_3m: 25.0,
  referral_bonus_6m: 25.0,
};

async function main() {
  console.log(`Seeding ${packagesData.length} packages...`);

  for (const pkg of packagesData) {
    const data = { ...pkg, ...REFERRAL_BONUS_SCHEDULE };

    await prisma.package.upsert({
      where: { name: pkg.name },
      update: data,
      create: data,
    });
  }

  console.log("Packages seeded successfully.");
}

main()
  .catch((error) => {
    console.error("Seed failed:", error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
