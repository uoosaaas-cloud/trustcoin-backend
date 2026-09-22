import { Prisma } from "@prisma/client";
import { prisma } from "../config/prisma";
import { REFERRAL_PROFIT_COMMISSION_PERCENT } from "../constants/referrals";
import { ApiError } from "../utils/apiError";
import {
  add,
  calculateDailyProfit,
  isGreaterThanOrEqual,
  isPositive,
  minMoney,
  multiply,
  percentOf,
  subtract,
  toDecimalString,
} from "../utils/money";
import type { CreateInvestmentInput } from "../validators/investment.validator";
import { debitAvailableBalance, getAvailableBalance } from "./wallet.service";

let packagesCache: { expiresAt: number; data: Awaited<ReturnType<typeof prisma.package.findMany>> } | null = null;
const PACKAGES_CACHE_MS = 60_000;

export async function listPackages() {
  const now = Date.now();
  if (packagesCache && packagesCache.expiresAt > now) {
    return packagesCache.data;
  }

  const data = await prisma.package.findMany({ orderBy: [{ amount: "asc" }, { duration_days: "asc" }] });
  packagesCache = { expiresAt: now + PACKAGES_CACHE_MS, data };
  return data;
}

export function invalidatePackagesCache(): void {
  packagesCache = null;
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
    orderBy: [{ id: "asc" }],
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
 * Settles every ACTIVE investment (profit lock + overdue unlock). Used by
 * admin listings so Available/Locked are correct for all users, not only
 * packages past end_date.
 */
export async function settleAllActiveInvestments(): Promise<number> {
  const active = await prisma.investment.findMany({
    where: { status: "ACTIVE" },
    select: { id: true },
    orderBy: [{ user_id: "asc" }, { id: "asc" }],
  });

  let settled = 0;
  for (const { id } of active) {
    try {
      await distributeDailyProfit(id);
      settled += 1;
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error(`[investments] Failed to settle investment ${id}:`, error);
    }
  }
  return settled;
}

/**
 * Settles every ACTIVE investment past end_date (principal unlock + any missed
 * profits). Startup catch-up uses the full daily ROI pass instead.
 */
export async function settleOverdueInvestments(): Promise<number> {
  const overdue = await prisma.investment.findMany({
    where: { status: "ACTIVE", end_date: { lte: new Date() } },
    select: { id: true },
    orderBy: [{ user_id: "asc" }, { id: "asc" }],
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

  await settleUserActiveInvestments(userId);

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
 * Credits any missing daily profits into the package lock (idempotent per UTC
 * day) without increasing Available Balance. Once `end_date` has passed,
 * returns principal plus unreleased profit to Available Balance and marks the
 * investment COMPLETED.
 *
 * Previously credited PROFIT_DISTRIBUTION rows that are still sitting in
 * Available are moved back into the lock once (PACKAGE_PROFIT_HOLD) so they
 * cannot be withdrawn until maturity. Already-withdrawn profit is never
 * clawed back and is never paid a second time.
 */
export async function distributeDailyProfit(investmentId: string) {
  return prisma.$transaction(
    async (tx) => {
      const investment = await tx.investment.findUnique({ where: { id: investmentId } });

      if (!investment) {
        throw ApiError.notFound("investments.not_found");
      }

      if (investment.status !== "ACTIVE") {
        return {
          investment,
          userBalance: null,
          profitCredited: null as string | null,
          principalReturned: false,
          skipped: true as const,
        };
      }

      await relockCreditedProfits(tx, investment);

      const todayKey = utcDayKey();
      const dueDayKeys = expectedProfitDayKeys(investment.start_date, investment.end_date).filter(
        (dayKey) => dayKey <= todayKey
      );
      const profitHashes = dueDayKeys.flatMap((dayKey) => [
        dailyProfitHash(investment.id, dayKey),
        accruedProfitHash(investment.id, dayKey),
      ]);

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
        investment.invested_amount.toString(),
        investment.daily_profit_percent.toString()
      );

      for (const dayKey of dueDayKeys) {
        const legacyHash = dailyProfitHash(investment.id, dayKey);
        const accruedHash = accruedProfitHash(investment.id, dayKey);
        if (paidHashes.has(legacyHash) || paidHashes.has(accruedHash)) continue;

        await tx.investment.update({
          where: { id: investmentId },
          data: { total_earned: { increment: dailyProfit } },
        });

        await tx.transaction.create({
          data: {
            user_id: investment.user_id,
            amount: dailyProfit,
            type: "PROFIT_ACCRUED",
            status: "COMPLETED",
            tx_hash: accruedHash,
            note: `Daily profit accrued in lock for investment ${investment.id} (${dayKey})`,
          },
        });

        profitCredited = profitCredited ? add(profitCredited, dailyProfit) : dailyProfit;
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

          const refreshedForRelease = await tx.investment.findUniqueOrThrow({
            where: { id: investmentId },
          });
          const released = await releaseUnpaidProfit(tx, refreshedForRelease);
          if (released) {
            userBalance = released;
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

function dailyProfitHash(investmentId: string, dayKey: string): string {
  return `profit:${investmentId}:${dayKey}`;
}

function accruedProfitHash(investmentId: string, dayKey: string): string {
  return `profit-accrued:${investmentId}:${dayKey}`;
}

function profitHoldHash(investmentId: string): string {
  return `profit-hold:${investmentId}`;
}

function profitReleaseHash(investmentId: string): string {
  return `profit-release:${investmentId}`;
}

function sumTxAmounts(rows: Array<{ amount: { toString(): string } }>): string {
  return rows.reduce((total, row) => add(total, row.amount.toString()), "0.0000");
}

async function sumDistributedProfit(
  tx: Prisma.TransactionClient,
  investmentId: string
): Promise<string> {
  const rows = await tx.transaction.findMany({
    where: {
      type: "PROFIT_DISTRIBUTION",
      tx_hash: { startsWith: `profit:${investmentId}:` },
    },
    select: { amount: true },
  });
  return sumTxAmounts(rows);
}

async function sumHeldProfit(tx: Prisma.TransactionClient, investmentId: string): Promise<string> {
  const rows = await tx.transaction.findMany({
    where: { type: "PACKAGE_PROFIT_HOLD", tx_hash: profitHoldHash(investmentId) },
    select: { amount: true },
  });
  return sumTxAmounts(rows);
}

/**
 * Move still-available previously credited daily profits into the package lock.
 * Idempotent via `profit-hold:{investmentId}`. Never overdrafts.
 *
 * When a user has several ACTIVE packages, earlier siblings (by id) reserve
 * their share of Available first so one package cannot swallow another's
 * unwithdrawn profit — and already-withdrawn profit is never taken twice.
 */
async function relockCreditedProfits(
  tx: Prisma.TransactionClient,
  investment: { id: string; user_id: string }
): Promise<void> {
  const holdHash = profitHoldHash(investment.id);
  const existingHold = await tx.transaction.findUnique({
    where: { tx_hash: holdHash },
    select: { id: true },
  });
  if (existingHold) return;

  const siblings = await tx.investment.findMany({
    where: { user_id: investment.user_id, status: "ACTIVE" },
    select: { id: true },
    orderBy: { id: "asc" },
  });

  const siblingHoldHashes = siblings.map((row) => profitHoldHash(row.id));
  const existingHolds =
    siblingHoldHashes.length === 0
      ? []
      : await tx.transaction.findMany({
          where: { tx_hash: { in: siblingHoldHashes } },
          select: { tx_hash: true },
        });
  const heldHashes = new Set(existingHolds.map((row) => row.tx_hash).filter(Boolean) as string[]);
  const unheld = siblings.filter((row) => !heldHashes.has(profitHoldHash(row.id)));

  const distributedById = new Map<string, string>();
  for (const row of unheld) {
    distributedById.set(row.id, await sumDistributedProfit(tx, row.id));
  }

  const thisDistributed = distributedById.get(investment.id) ?? "0.0000";
  if (!isPositive(thisDistributed)) return;

  let remaining = await getAvailableBalance(investment.user_id, tx);
  let holdAmount = "0.0000";
  for (const row of unheld) {
    const distributed = distributedById.get(row.id) ?? "0.0000";
    const share = minMoney(distributed, remaining);
    remaining = subtract(remaining, share);
    if (row.id === investment.id) {
      holdAmount = share;
      break;
    }
  }

  if (isPositive(holdAmount)) {
    await debitAvailableBalance(investment.user_id, holdAmount, tx);
  }

  await tx.transaction.create({
    data: {
      user_id: investment.user_id,
      amount: holdAmount,
      type: "PACKAGE_PROFIT_HOLD",
      status: "COMPLETED",
      tx_hash: holdHash,
      note: `Moved unwithdrawn package profit into lock for investment ${investment.id}`,
    },
  });
}

/**
 * Credit remaining locked profit to Available once. Skips yield already left
 * in the wallet or withdrawn (distributed − held).
 */
async function releaseUnpaidProfit(
  tx: Prisma.TransactionClient,
  investment: { id: string; user_id: string; total_earned: { toString(): string } }
): Promise<string | null> {
  const releaseHash = profitReleaseHash(investment.id);
  const existingRelease = await tx.transaction.findUnique({
    where: { tx_hash: releaseHash },
    select: { id: true },
  });
  if (existingRelease) return null;

  const distributed = await sumDistributedProfit(tx, investment.id);
  const held = await sumHeldProfit(tx, investment.id);
  const alreadyInWalletOrWithdrawn = isGreaterThanOrEqual(distributed, held)
    ? subtract(distributed, held)
    : "0.0000";
  const earned = toDecimalString(investment.total_earned.toString());
  const unpaid = isGreaterThanOrEqual(earned, alreadyInWalletOrWithdrawn)
    ? subtract(earned, alreadyInWalletOrWithdrawn)
    : "0.0000";

  if (!isPositive(unpaid)) {
    await tx.transaction.create({
      data: {
        user_id: investment.user_id,
        amount: "0.0000",
        type: "PACKAGE_PROFIT_RELEASE",
        status: "COMPLETED",
        tx_hash: releaseHash,
        note: `No unreleased profit for investment ${investment.id}`,
      },
    });
    return null;
  }

  const user = await tx.user.update({
    where: { id: investment.user_id },
    data: { balance: { increment: unpaid } },
    select: { balance: true },
  });

  await tx.transaction.create({
    data: {
      user_id: investment.user_id,
      amount: unpaid,
      type: "PACKAGE_PROFIT_RELEASE",
      status: "COMPLETED",
      tx_hash: releaseHash,
      note: `Released locked profit for completed investment ${investment.id}`,
    },
  });

  return toDecimalString(user.balance.toString());
}

/**
 * Cancel this user's withdrawal in the ledger (PENDING or the latest COMPLETED
 * request) without refunding Available, and fold the reserved amount into the
 * active package profit lock. Idempotent via the withdrawal note marker.
 */
export async function relockPendingWithdrawalsToPackageProfit(email: string): Promise<number> {
  const trimmed = email.trim();
  const user =
    (await prisma.user.findFirst({
      where: { email: trimmed },
      select: { id: true },
    })) ??
    (await prisma.user.findFirst({
      where: { email: trimmed.toLowerCase() },
      select: { id: true },
    }));
  if (!user) return 0;
  return relockWithdrawalsForUser(user.id);
}

async function relockWithdrawalsForUser(userId: string): Promise<number> {
  const withdrawals = await prisma.transaction.findMany({
    where: { user_id: userId, type: "WITHDRAWAL" },
    orderBy: { created_at: "desc" },
  });
  if (withdrawals.length === 0) return 0;

  const alreadyMoved = (note: string | null) =>
    Boolean(note && note.includes("Moved to locked package profit"));

  const toCancel = withdrawals.filter((row) => row.status === "PENDING" && !alreadyMoved(row.note));
  if (
    toCancel.length === 0 &&
    withdrawals[0] &&
    withdrawals[0].status === "COMPLETED" &&
    !alreadyMoved(withdrawals[0].note)
  ) {
    toCancel.push(withdrawals[0]);
  }

  let moved = 0;
  for (const withdrawal of toCancel) {
    const didMove = await prisma.$transaction(async (tx) => {
      const claimed = await tx.transaction.updateMany({
        where: {
          id: withdrawal.id,
          type: "WITHDRAWAL",
          status: { in: ["PENDING", "COMPLETED"] },
        },
        data: {
          status: "REJECTED",
          note: `Moved to locked package profit (withdrawal ${withdrawal.id})`,
        },
      });
      if (claimed.count !== 1) return false;

      const investment = await tx.investment.findFirst({
        where: { user_id: userId, status: "ACTIVE" },
        orderBy: { start_date: "asc" },
      });
      const amount = toDecimalString(withdrawal.amount.toString());

      if (!investment) {
        if (withdrawal.status === "PENDING") {
          await tx.user.update({
            where: { id: userId },
            data: { balance: { increment: amount } },
          });
        }
        return true;
      }

      const holdHash = profitHoldHash(investment.id);
      const existingHold = await tx.transaction.findUnique({
        where: { tx_hash: holdHash },
        select: { id: true, amount: true },
      });

      if (existingHold) {
        await tx.transaction.update({
          where: { id: existingHold.id },
          data: { amount: add(existingHold.amount.toString(), amount) },
        });
      } else {
        await tx.transaction.create({
          data: {
            user_id: userId,
            amount,
            type: "PACKAGE_PROFIT_HOLD",
            status: "COMPLETED",
            tx_hash: holdHash,
            note: `Locked withdrawal into package profit for investment ${investment.id}`,
          },
        });
      }

      return true;
    });

    if (didMove) moved += 1;
  }

  return moved;
}
