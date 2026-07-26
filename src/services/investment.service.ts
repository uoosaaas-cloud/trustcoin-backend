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
function utcDayKey(date = new Date()): string {
  return date.toISOString().slice(0, 10);
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
 * Distributes one day of profit for a single active investment (idempotent per UTC day).
 * On maturity, returns principal once and marks referral rewards awaiting admin.
 */
export async function distributeDailyProfit(investmentId: string) {
  return prisma.$transaction(async (tx) => {
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

    const dayKey = utcDayKey();
    const profitTxHash = `profit:${investmentId}:${dayKey}`;
    const existingProfit = await tx.transaction.findUnique({
      where: { tx_hash: profitTxHash },
      select: { id: true },
    });

    let profitCredited: string | null = null;
    let userBalance: string | null = null;

    if (!existingProfit) {
      const dailyProfit = calculateDailyProfit(
        investment.current_amount.toString(),
        investment.daily_profit_percent.toString()
      );

      await tx.investment.update({
        where: { id: investmentId },
        data: { total_earned: add(investment.total_earned.toString(), dailyProfit) },
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

      profitCredited = dailyProfit;
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
  });
}
