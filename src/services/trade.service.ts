import { prisma } from "../config/prisma";
import { ApiError } from "../utils/apiError";
import { toDecimalString } from "../utils/money";
import { logAdminAction } from "./admin.service";
import type { CreateTradeInput, UpdateTradeInput } from "../validators/trade.validator";

function serializeTrade(trade: {
  id: string;
  symbol: string;
  side: string;
  amount: { toString(): string };
  outcome: string;
  note: string | null;
  is_active: boolean;
  created_by_admin_id: string;
  created_at: Date;
  updated_at: Date;
}) {
  return {
    id: trade.id,
    symbol: trade.symbol,
    side: trade.side,
    amount: toDecimalString(trade.amount.toString()),
    outcome: trade.outcome,
    note: trade.note,
    isActive: trade.is_active,
    createdByAdminId: trade.created_by_admin_id,
    createdAt: trade.created_at.toISOString(),
    updatedAt: trade.updated_at.toISOString(),
  };
}

/** Public list of active trades for authenticated users. */
export async function listActiveTradesForUsers() {
  const trades = await prisma.trade.findMany({
    where: { is_active: true },
    orderBy: { created_at: "desc" },
    take: 100,
  });
  return trades.map(serializeTrade);
}

/** Admin list — includes inactive rows. */
export async function listTradesForAdmin() {
  const trades = await prisma.trade.findMany({
    orderBy: { created_at: "desc" },
    take: 200,
  });
  return trades.map(serializeTrade);
}

export async function createTrade(adminId: string, input: CreateTradeInput) {
  const trade = await prisma.trade.create({
    data: {
      symbol: input.symbol,
      side: input.side,
      amount: input.amount,
      outcome: input.outcome,
      note: input.note || null,
      is_active: input.isActive ?? true,
      created_by_admin_id: adminId,
    },
  });

  await logAdminAction(
    adminId,
    "CREATE_TRADE",
    `${trade.symbol} ${trade.side} ${toDecimalString(trade.amount.toString())} ${trade.outcome}`
  );

  return serializeTrade(trade);
}

export async function updateTrade(adminId: string, tradeId: string, input: UpdateTradeInput) {
  const existing = await prisma.trade.findUnique({ where: { id: tradeId } });
  if (!existing) {
    throw ApiError.notFound("trade.not_found");
  }

  const trade = await prisma.trade.update({
    where: { id: tradeId },
    data: {
      ...(input.symbol !== undefined ? { symbol: input.symbol } : {}),
      ...(input.side !== undefined ? { side: input.side } : {}),
      ...(input.amount !== undefined ? { amount: input.amount } : {}),
      ...(input.outcome !== undefined ? { outcome: input.outcome } : {}),
      ...(input.note !== undefined ? { note: input.note || null } : {}),
      ...(input.isActive !== undefined ? { is_active: input.isActive } : {}),
    },
  });

  await logAdminAction(adminId, "UPDATE_TRADE", `tradeId=${tradeId}`);
  return serializeTrade(trade);
}

export async function deleteTrade(adminId: string, tradeId: string) {
  const existing = await prisma.trade.findUnique({ where: { id: tradeId } });
  if (!existing) {
    throw ApiError.notFound("trade.not_found");
  }

  await prisma.trade.delete({ where: { id: tradeId } });
  await logAdminAction(adminId, "DELETE_TRADE", `tradeId=${tradeId} symbol=${existing.symbol}`);
  return { id: tradeId };
}
