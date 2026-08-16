import { randomUUID } from "crypto";
import { prisma } from "../config/prisma";
import { ApiError } from "../utils/apiError";
import { isPositive, toDecimalString } from "../utils/money";
import { queueEmail, sendGiftNotification } from "./email.service";
import { logAdminAction } from "./admin.service";
import type { DistributeGiftsInput } from "../validators/gift.validator";

export interface GiftDistributionResult {
  amount: string;
  targeted: number;
  credited: number;
  failed: number;
  skippedAdmin: number;
  recipients: Array<{ userId: string; email: string; transactionId: string }>;
}

async function resolveRecipients(input: DistributeGiftsInput) {
  if (input.scope === "ALL_EXCEPT_ADMIN") {
    return prisma.user.findMany({
      where: { role: "USER", status: "ACTIVE" },
      select: { id: true, email: true, role: true, status: true },
      orderBy: { created_at: "asc" },
    });
  }

  const uniqueIds = [...new Set(input.userIds ?? [])];
  const users = await prisma.user.findMany({
    where: { id: { in: uniqueIds } },
    select: { id: true, email: true, role: true, status: true },
  });

  if (users.length !== uniqueIds.length) {
    throw ApiError.badRequest("admin.gift_users_not_found");
  }

  if (users.some((user) => user.role === "ADMIN")) {
    throw ApiError.badRequest("admin.gift_admin_excluded");
  }

  return users.filter((user) => user.status === "ACTIVE");
}

async function creditOneGift(params: {
  userId: string;
  email: string;
  amount: string;
  note?: string;
  adminId: string;
}) {
  const claimId = randomUUID();
  const txHash = `gift:${claimId}`;

  const created = await prisma.$transaction(async (tx) => {
    const user = await tx.user.update({
      where: { id: params.userId },
      data: { balance: { increment: params.amount } },
      select: { id: true, email: true, balance: true },
    });

    const transaction = await tx.transaction.create({
      data: {
        user_id: params.userId,
        amount: params.amount,
        type: "GIFT",
        status: "COMPLETED",
        tx_hash: txHash,
        note: params.note
          ? `Admin gift: ${params.note}`
          : `Admin gift of ${params.amount} USDT credited to available balance.`,
      },
    });

    await tx.depositRequest.create({
      data: {
        id: claimId,
        user_id: params.userId,
        amount: params.amount,
        currency: "USDT",
        network: "GIFT",
        tx_hash: txHash,
        status: "APPROVED",
        reviewed_by_admin_id: params.adminId,
      },
    });

    return { user, transaction };
  });

  queueEmail(
    () => sendGiftNotification(params.email, params.amount, params.note),
    `gift-notify:${params.email}:${created.transaction.id}`
  );

  return created.transaction.id;
}

export async function distributeGifts(
  adminId: string,
  input: DistributeGiftsInput
): Promise<GiftDistributionResult> {
  const amount = toDecimalString(input.amount);
  if (!isPositive(amount)) {
    throw ApiError.badRequest("admin.gift_amount_invalid");
  }

  const recipients = await resolveRecipients(input);
  if (recipients.length === 0) {
    throw ApiError.badRequest("admin.gift_no_recipients");
  }

  const note = input.note?.trim() || undefined;
  const result: GiftDistributionResult = {
    amount,
    targeted: recipients.length,
    credited: 0,
    failed: 0,
    skippedAdmin: 0,
    recipients: [],
  };

  for (const user of recipients) {
    try {
      const transactionId = await creditOneGift({
        userId: user.id,
        email: user.email,
        amount,
        note,
        adminId,
      });
      result.credited += 1;
      result.recipients.push({ userId: user.id, email: user.email, transactionId });
    } catch (error) {
      result.failed += 1;
      // eslint-disable-next-line no-console
      console.error(`[gifts] Failed to credit ${user.email}:`, error);
    }
  }

  await logAdminAction(
    adminId,
    "DISTRIBUTE_GIFTS",
    `Gift ${amount} USDT → ${result.credited}/${result.targeted} users (${input.scope})`
  );

  return result;
}
