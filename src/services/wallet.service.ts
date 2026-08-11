import { Prisma } from "@prisma/client";
import { prisma } from "../config/prisma";
import { add, toDecimalString } from "../utils/money";
import { ApiError } from "../utils/apiError";

/**
 * Atomically debit available balance. Prevents overdraft under concurrent
 * purchase/withdraw races (UPDATE … WHERE balance >= amount).
 */
export async function debitAvailableBalance(
  userId: string,
  amount: string,
  tx: Prisma.TransactionClient,
  insufficientKey = "transactions.insufficient_available_balance"
): Promise<void> {
  const result = await tx.$executeRaw`
    UPDATE users
    SET balance = balance - ${amount}
    WHERE id = ${userId} AND balance >= ${amount}
  `;

  if (Number(result) !== 1) {
    const availableBalance = await getAvailableBalance(userId, tx);
    throw ApiError.badRequest(
      insufficientKey,
      { availableBalance, requested: amount },
      { availableBalance }
    );
  }
}

export interface WalletBalanceSummary {
  /** Available for withdrawal / new investments (User.balance). */
  availableBalance: string;
  /** Capital locked in ACTIVE investment packages (`current_amount` sum). */
  lockedBalance: string;
  /** Total Balance = Locked + Available. */
  totalBalance: string;
  /** Sum of PENDING withdrawal amounts (already deducted from available). */
  pendingWithdrawalBalance: string;
  /** Referral commissions locked until package maturity + admin release. */
  pendingReferralBonus: string;
  currency: "USDT";
}

/**
 * Computes the user's balance breakdown.
 *
 * - Available = `User.balance`
 * - Locked = sum of ACTIVE investment `current_amount`
 * - Pending referral bonus = `User.pending_referral_bonus` (not withdrawable)
 * - Total = Available + Locked
 *
 * Before reading, settles ACTIVE investments so matured principal moves from
 * Locked → Available even if the daily cron was missed (e.g. sleeping dyno).
 */
export async function getWalletBalanceSummary(userId: string): Promise<WalletBalanceSummary> {
  // Dynamic import avoids a circular dependency with investment.service
  // (which imports debitAvailableBalance from this module).
  const { settleUserActiveInvestments } = await import("./investment.service");
  await settleUserActiveInvestments(userId);

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { balance: true, pending_referral_bonus: true },
  });

  if (!user) {
    throw ApiError.notFound("errors.not_found");
  }

  const [lockedAgg, pendingAgg] = await Promise.all([
    prisma.investment.aggregate({
      where: { user_id: userId, status: "ACTIVE" },
      _sum: { current_amount: true },
    }),
    prisma.transaction.aggregate({
      where: { user_id: userId, type: "WITHDRAWAL", status: "PENDING" },
      _sum: { amount: true },
    }),
  ]);

  const availableBalance = toDecimalString(user.balance.toString());
  const lockedBalance = toDecimalString(lockedAgg._sum.current_amount?.toString() ?? "0");
  const pendingWithdrawalBalance = toDecimalString(pendingAgg._sum.amount?.toString() ?? "0");
  const pendingReferralBonus = toDecimalString(user.pending_referral_bonus.toString());
  const totalBalance = add(availableBalance, lockedBalance);

  return {
    availableBalance,
    lockedBalance,
    totalBalance,
    pendingWithdrawalBalance,
    pendingReferralBonus,
    currency: "USDT",
  };
}

/** Convenience helper for services that only need the withdrawable amount. */
export async function getAvailableBalance(userId: string, tx?: Prisma.TransactionClient): Promise<string> {
  const client = tx ?? prisma;
  const user = await client.user.findUnique({
    where: { id: userId },
    select: { balance: true },
  });

  if (!user) {
    throw ApiError.notFound("errors.not_found");
  }

  return toDecimalString(user.balance.toString());
}
