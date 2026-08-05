import { prisma } from "../config/prisma";
import { env } from "../config/env";
import { ApiError } from "../utils/apiError";
import { isGreaterThanOrEqual, toDecimalString } from "../utils/money";
import { debitAvailableBalance, getAvailableBalance } from "./wallet.service";
import { issueOtp, consumeOtp } from "./otp.service";
import {
  queueEmail,
  sendAdminNewWithdrawalAlert,
  sendWithdrawalStatusEmail,
} from "./email.service";
import type { CreateWithdrawalInput } from "../validators/transaction.validator";

export async function listUserTransactions(userId: string) {
  return prisma.transaction.findMany({
    where: { user_id: userId },
    orderBy: { created_at: "desc" },
  });
}

export async function listUserWithdrawals(userId: string) {
  return prisma.transaction.findMany({
    where: { user_id: userId, type: "WITHDRAWAL" },
    orderBy: { created_at: "desc" },
  });
}

/** Dispatches a withdrawal confirmation OTP to the authenticated user's email. */
export async function sendWithdrawalOtp(userId: string): Promise<string> {
  const user = await prisma.user.findUnique({ where: { id: userId } });

  if (!user) {
    throw ApiError.notFound("auth.user_not_found");
  }

  if (!user.is_verified) {
    throw ApiError.forbidden("auth.account_not_verified");
  }

  return issueOtp(user.email, user.language, "WITHDRAWAL");
}

/**
 * Creates a pending withdrawal request after validating the email OTP.
 * Funds are taken from Available Balance (`User.balance`) only — never from
 * Locked Package Balance. While PENDING, the amount is temporarily removed
 * from Available Balance (reserved). Admin approve keeps it gone; reject refunds it.
 */
export async function createWithdrawal(userId: string, input: CreateWithdrawalInput) {
  const amount = toDecimalString(input.amount);

  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) {
    throw ApiError.notFound("auth.user_not_found");
  }

  const availableBefore = await getAvailableBalance(userId);
  if (!isGreaterThanOrEqual(availableBefore, amount)) {
    throw ApiError.badRequest(
      "transactions.insufficient_available_balance",
      { availableBalance: availableBefore, requested: amount },
      { availableBalance: availableBefore }
    );
  }

  await consumeOtp(user.email, input.otp_code, "WITHDRAWAL");

  const withdrawal = await prisma.$transaction(async (tx) => {
    await debitAvailableBalance(userId, amount, tx);

    return tx.transaction.create({
      data: {
        user_id: userId,
        amount,
        type: "WITHDRAWAL",
        status: "PENDING",
        payment_address: input.payment_address.trim(),
        network: input.network,
        note: input.note?.trim() || null,
      },
    });
  });

  queueEmail(
    () => sendWithdrawalStatusEmail(user.email, amount, "PENDING"),
    `withdraw-pending:${user.email}`
  );

  const adminInbox = env.ADMIN_ALERT_EMAIL;
  if (adminInbox) {
    queueEmail(
      () =>
        sendAdminNewWithdrawalAlert(
          adminInbox,
          user.email,
          amount,
          input.payment_address.trim(),
          input.network
        ),
      `withdraw-admin-alert:${withdrawal.id}`
    );
  }

  return withdrawal;
}
