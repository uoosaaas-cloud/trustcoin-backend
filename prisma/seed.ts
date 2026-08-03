import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

/**
 * Period total-return % for each amount tier × duration.
 * Stored as daily_profit_percent = periodReturn / durationDays (4 d.p.).
 */
const DURATION_LABELS: Record<number, string> = {
  7: "7 Days",
  30: "1 Month",
  90: "3 Months",
  180: "6 Months",
};

const DURATIONS = [7, 30, 90, 180] as const;

/** [amount, 7d%, 1m%, 3m%, 6m%] — period return percentages from product plan. */
const TIER_PERIOD_RETURNS: Array<[number, number, number, number, number]> = [
  [100, 10, 42, 138, 270],
  [200, 11, 43, 140, 272],
  [300, 12, 44, 142, 274],
  [400, 13, 45, 144, 276],
  [500, 14, 46, 146, 278],
  [1000, 15, 47, 148, 280],
  [1500, 16, 48, 150, 282],
  [2000, 17, 49, 152, 284],
  [3000, 18, 50, 154, 286],
  [5000, 19, 51, 156, 288],
  [8000, 20, 52, 158, 290],
  [10000, 21, 53, 160, 292],
  [20000, 22, 54, 162, 294],
  [50000, 23, 55, 165, 350],
];

/** Convert period return % → daily % rounded to 4 d.p. (Decimal(5,4)). */
function dailyFromPeriod(periodPercent: number, days: number): number {
  return Math.round((periodPercent / days) * 10000) / 10000;
}

const packagesData = TIER_PERIOD_RETURNS.flatMap(([amount, r7, r30, r90, r180]) => {
  const returns: Record<(typeof DURATIONS)[number], number> = {
    7: r7,
    30: r30,
    90: r90,
    180: r180,
  };

  return DURATIONS.map((days) => ({
    name: `Plan ${amount} - ${DURATION_LABELS[days]}`,
    amount,
    daily_profit_percent: dailyFromPeriod(returns[days], days),
    duration_days: days,
  }));
});

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

  const keepNames = packagesData.map((pkg) => pkg.name);
  const obsolete = await prisma.package.findMany({
    where: { name: { notIn: keepNames } },
    include: { _count: { select: { investments: true } } },
  });

  let deleted = 0;
  let keptWithInvestments = 0;

  for (const pkg of obsolete) {
    if (pkg._count.investments > 0) {
      keptWithInvestments += 1;
      console.warn(
        `Keeping obsolete package "${pkg.name}" (${pkg.id}) — ${pkg._count.investments} investment(s) still reference it.`
      );
      continue;
    }

    await prisma.package.delete({ where: { id: pkg.id } });
    deleted += 1;
  }

  console.log(
    `Packages seeded successfully. Upserted ${packagesData.length}, deleted ${deleted} obsolete, kept ${keptWithInvestments} obsolete with investments.`
  );
}

main()
  .catch((error) => {
    console.error("Seed failed:", error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
