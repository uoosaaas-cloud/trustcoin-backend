import { prisma } from "../config/prisma";
import { REFERRAL_PROFIT_COMMISSION_PERCENT } from "../constants/referrals";
import { ApiError } from "../utils/apiError";
import {
  add,
  calculateDailyProfit,
  isGreaterThanOrEqual,
  isPositive,
  multiply,
  percentOf,
  toDecimalString,
} from "../utils/money";
import type { CreateInvestmentInput } from "../validators/investment.validator";
import { debitAvailableBalance } from "./wallet.service";

export async function listPackages() {
  return prisma.package.findMany({ orderBy: [{ amount: "asc" }, { duration_days: "asc" }] });
}

export async function listUserInvestments(userId: string) {
  // Catch up missed daily profits / principal unlock before listing.
  await settleUserActiveInvestments(userId);

  return prisma.investment.findMany({
    where: { user_id: userId },
    include: { package: true },
    orderBy: { start_date: "desc" },
  });
}

/**
 * Expected package profit (yield) over the full duration:
 * dailyProfit(amount) × duration_days.
 */
export function calculateExpectedPackageProfit(
  packageAmount: string,
  dailyProfitPercent: string,
  durationDays: number
): string {
  const daily = calculateDailyProfit(packageAmount, dailyProfitPercent);
  return multiply(daily, durationDays);
}

/** UTC calendar day key used for daily-profit idempotency. */
export function utcDayKey(date = new Date()): string {
  return date.toISOString().slice(0, 10);
}

/**
 * UTC midnights that should receive daily profit for a package.
 * Matches the midnight cron model: each 00:00 UTC with
 * `start_date < midnight <= end_date` earns one day (≈ duration_days ticks).
 */
export function expectedProfitDayKeys(startDate: Date, endDate: Date): string[] {
  const keys: string[] = [];
  const cursor = new Date(
    Date.UTC(startDate.getUTCFullYear(), startDate.getUTCMonth(), startDate.getUTCDate() + 1)
  );

  while (cursor.getTime() <= endDate.getTime()) {
    keys.push(utcDayKey(cursor));
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }

  return keys;
}

/**
 * Settles all ACTIVE investments for a user (missed daily profits + principal
 * unlock after end_date). Safe / idempotent to call on wallet reads.
 */
export async function settleUserActiveInvestments(userId: string): Promise<number> {
  const active = await prisma.investment.findMany({
    where: { user_id: userId, status: "ACTIVE" },
    select: { id: true },
    orderBy: { end_date: "asc" },
  });

  let settled = 0;
  for (const { id } of active) {
    try {
      await distributeDailyProfit(id);
      settled += 1;
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error(`[investments] Failed to settle investment ${id} for user ${userId}:`, error);
    }
  }
  return settled;
}

/**
 * Settles every ACTIVE investment past end_date (principal unlock + any missed
 * profits). Used by admin listings and startup catch-up paths.
 */
export async function settleOverdueInvestments(): Promise<number> {
  const overdue = await prisma.investment.findMany({
    where: { status: "ACTIVE", end_date: { lte: new Date() } },
    select: { id: true },
    orderBy: { end_date: "asc" },
  });

  let settled = 0;
  for (const { id } of overdue) {
    try {
      await distributeDailyProfit(id);
      settled += 1;
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error(`[investments] Failed to settle overdue investment ${id}:`, error);
    }
  }
  return settled;
}

/**
 * Purchases an investment package: debits Available Balance and creates an
 * ACTIVE investment whose capital counts toward Locked Balance until maturity.
 */
export async function purchaseInvestment(userId: string, input: CreateInvestmentInput) {
  const pkg = await prisma.package.findUnique({ where: { id: input.packageId } });

  if (!pkg) {
    throw ApiError.notFound("investments.package_not_found");
  }

  const amount = toDecimalString(pkg.amount.toString());

  // Fixed-price packages: client may send amount, but it must match exactly.
  if (input.amount !== undefined) {
    const requested = toDecimalString(input.amount);
    if (requested !== amount) {
      throw ApiError.badRequest("investments.amount_must_match_package", undefined, {
        packageAmount: amount,
      });
    }
  }

  if (!isGreaterThanOrEqual(amount, "0") || !isPositive(amount)) {
    throw ApiError.badRequest("investments.amount_below_minimum", undefined, {
      minLimit: amount,
    });
  }

  return prisma.$transaction(async (tx) => {
    await debitAvailableBalance(userId, amount, tx, "investments.insufficient_available_balance");

    const user = await tx.user.findUniqueOrThrow({ where: { id: userId } });

    const startDate = new Date();
    const endDate = new Date(startDate);
    endDate.setUTCDate(endDate.getUTCDate() + pkg.duration_days);

    const investment = await tx.investment.create({
      data: {
        user_id: userId,
        package_id: pkg.id,
        invested_amount: amount,
        base_amount: amount,
        current_amount: amount,
        daily_profit_percent: pkg.daily_profit_percent,
        start_date: startDate,
        end_date: endDate,
      },
      include: { package: true },
    });

    await tx.transaction.create({
      data: {
        user_id: userId,
        amount,
        type: "PACKAGE_PURCHASE",
        status: "COMPLETED",
        tx_hash: `package-purchase:${investment.id}`,
        note: `Funds allocated to investment ${investment.id} (${pkg.name})`,
      },
    });

    // Referral commission = 25% of expected package PROFIT (not capital).
    // Locked in pending_referral_bonus until package matures + admin release.
    if (user.referred_by_id) {
      const expectedProfit = calculateExpectedPackageProfit(
        amount,
        pkg.daily_profit_percent.toString(),
        pkg.duration_days
      );
      const bonusAmount = percentOf(expectedProfit, REFERRAL_PROFIT_COMMISSION_PERCENT);

      if (isPositive(bonusAmount)) {
        await tx.user.update({
          where: { id: user.referred_by_id },
          data: { pending_referral_bonus: { increment: bonusAmount } },
        });

        await tx.referralReward.create({
          data: {
            referrer_id: user.referred_by_id,
            referee_id: userId,
            investment_id: investment.id,
            bonus_percentage: REFERRAL_PROFIT_COMMISSION_PERCENT,
            expected_profit: expectedProfit,
            bonus_amount: bonusAmount,
            status: "PENDING_PACKAGE_ACTIVE",
          },
        });
      }
    }

    return investment;
  });
}

/** @deprecated Prefer `purchaseInvestment` — kept for `POST /investments`. */
export async function createInvestment(userId: string, input: CreateInvestmentInput) {
  return purchaseInvestment(userId, input);
}

/**
 * Credits any missing daily profits (idempotent per UTC day) and, once
 * `end_date` has passed, returns principal to Available Balance and marks the
 * investment COMPLETED. Safe to re-run after missed cron ticks.
 *
 * Catch-up of many missed days can exceed the default 5s interactive
 * transaction timeout on remote DBs, so timeout is raised for this path.
 */
export async function distributeDailyProfit(investmentId: string) {
  return prisma.$transaction(
    async (tx) => {
      const investment = await tx.investment.findUnique({ where: { id: investmentId } });

      if (!investment) {
        throw ApiError.notFound("investments.not_found");
      }

      if (investment.status !== "ACTIVE") {
        // Already completed / inactive — safe no-op for cron re-runs.
        return {
          investment,
          userBalance: null,
          profitCredited: null as string | null,
          principalReturned: false,
          skipped: true as const,
        };
      }

      const todayKey = utcDayKey();
      const dueDayKeys = expectedProfitDayKeys(investment.start_date, investment.end_date).filter(
        (dayKey) => dayKey <= todayKey
      );
      const profitHashes = dueDayKeys.map((dayKey) => `profit:${investmentId}:${dayKey}`);

      const existingProfits =
        profitHashes.length === 0
          ? []
          : await tx.transaction.findMany({
              where: { tx_hash: { in: profitHashes } },
              select: { tx_hash: true },
            });
      const paidHashes = new Set(existingProfits.map((row) => row.tx_hash).filter(Boolean) as string[]);

      let profitCredited: string | null = null;
      let userBalance: string | null = null;
      const dailyProfit = calculateDailyProfit(
        investment.current_amount.toString(),
        investment.daily_profit_percent.toString()
      );

      for (const dayKey of dueDayKeys) {
        const profitTxHash = `profit:${investmentId}:${dayKey}`;
        if (paidHashes.has(profitTxHash)) continue;

        await tx.investment.update({
          where: { id: investmentId },
          data: { total_earned: { increment: dailyProfit } },
        });

        const user = await tx.user.update({
          where: { id: investment.user_id },
          data: { balance: { increment: dailyProfit } },
          select: { balance: true },
        });

        await tx.transaction.create({
          data: {
            user_id: investment.user_id,
            amount: dailyProfit,
            type: "PROFIT_DISTRIBUTION",
            status: "COMPLETED",
            tx_hash: profitTxHash,
            note: `Daily profit for investment ${investment.id} (${dayKey})`,
          },
        });

        profitCredited = profitCredited ? add(profitCredited, dailyProfit) : dailyProfit;
        userBalance = toDecimalString(user.balance.toString());
      }

      let principalReturned = false;
      const isMatured = new Date() >= investment.end_date;

      if (isMatured) {
        const completed = await tx.investment.updateMany({
          where: { id: investment.id, status: "ACTIVE" },
          data: { status: "COMPLETED" },
        });

        if (completed.count === 1) {
          const returnTxHash = `return:${investment.id}`;
          const existingReturn = await tx.transaction.findUnique({
            where: { tx_hash: returnTxHash },
            select: { id: true },
          });

          if (!existingReturn) {
            const principal = toDecimalString(investment.current_amount.toString());
            const user = await tx.user.update({
              where: { id: investment.user_id },
              data: { balance: { increment: principal } },
              select: { balance: true },
            });
            userBalance = toDecimalString(user.balance.toString());

            await tx.transaction.create({
              data: {
                user_id: investment.user_id,
                amount: principal,
                type: "PACKAGE_RETURN",
                status: "COMPLETED",
                tx_hash: returnTxHash,
                note: `Principal returned for completed investment ${investment.id}`,
              },
            });
            principalReturned = true;
          }

          await tx.referralReward.updateMany({
            where: { investment_id: investment.id, status: "PENDING_PACKAGE_ACTIVE" },
            data: { status: "PACKAGE_COMPLETED_AWAITING_ADMIN" },
          });
        }
      }

      const refreshed = await tx.investment.findUniqueOrThrow({ where: { id: investmentId } });

      return {
        investment: refreshed,
        userBalance,
        profitCredited,
        principalReturned,
        skipped: false as const,
      };
    },
    { maxWait: 20_000, timeout: 120_000 }
  );
}
