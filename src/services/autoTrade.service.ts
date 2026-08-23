import { prisma } from "../config/prisma";
import { env } from "../config/env";
import { Prisma } from "@prisma/client";

const SYMBOLS = ["XAUUSD", "BTC"] as const;
const SIDES = ["BUY", "SELL"] as const;
const AMOUNT_MIN = 300_000;
const AMOUNT_MAX = 3_200_000;
const AMOUNT_STEP = 10_000;
const AMOUNT_STEP_COUNT = (AMOUNT_MAX - AMOUNT_MIN) / AMOUNT_STEP;
const HOUR_START = 9;
const HOUR_END = 18;
const RIYADH_OFFSET_MS = 3 * 60 * 60 * 1000;

type AutoTradeSlot = {
  autoKey: string;
  symbol: (typeof SYMBOLS)[number];
  side: (typeof SIDES)[number];
  amount: number;
  scheduledAt: Date;
};

export type AutoTradePublishSummary = {
  skipped: boolean;
  reason?: string;
  published: number;
  alreadyPresent: number;
};

let isPublishing = false;

function riyadhWallClock(now = new Date()) {
  const shifted = new Date(now.getTime() + RIYADH_OFFSET_MS);
  return {
    year: shifted.getUTCFullYear(),
    month: shifted.getUTCMonth() + 1,
    day: shifted.getUTCDate(),
    hour: shifted.getUTCHours(),
    minute: shifted.getUTCMinutes(),
    weekday: shifted.getUTCDay(),
  };
}

function dayKey(year: number, month: number, day: number): string {
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function riyadhLocalToUtc(year: number, month: number, day: number, hour: number, minute: number): Date {
  return new Date(Date.UTC(year, month - 1, day, hour - 3, minute, 0, 0));
}

function hashDay(value: string): number {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function mulberry32(seed: number): () => number {
  let state = seed;
  return () => {
    state |= 0;
    state = (state + 0x6d2b79f5) | 0;
    let next = Math.imul(state ^ (state >>> 15), 1 | state);
    next = (next + Math.imul(next ^ (next >>> 7), 61 | next)) ^ next;
    return ((next ^ (next >>> 14)) >>> 0) / 4294967296;
  };
}

function planForDay(year: number, month: number, day: number): AutoTradeSlot[] {
  const key = dayKey(year, month, day);
  const random = mulberry32(hashDay(`trustcoin-auto-trades:${key}`));
  const count = 2 + Math.floor(random() * 3);
  const slots: AutoTradeSlot[] = [];

  for (let index = 0; index < count; index += 1) {
    const spanMinutes = (HOUR_END - HOUR_START) * 60;
    const minuteOffset = Math.floor(random() * (spanMinutes + 1));
    const totalMinutes = HOUR_START * 60 + minuteOffset;
    const hour = Math.floor(totalMinutes / 60);
    const minute = totalMinutes % 60;

    slots.push({
      autoKey: `${key}#${index}`,
      symbol: SYMBOLS[Math.floor(random() * SYMBOLS.length)],
      side: SIDES[Math.floor(random() * SIDES.length)],
      amount: AMOUNT_MIN + Math.floor(random() * (AMOUNT_STEP_COUNT + 1)) * AMOUNT_STEP,
      scheduledAt: riyadhLocalToUtc(year, month, day, hour, minute),
    });
  }

  return slots;
}

function isUniqueConstraintError(error: unknown): boolean {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002";
}

/**
 * Inserts today's due AUTO trades if missing. Global (no userId). Weekend-safe.
 * Idempotent via auto_key. Never backfills previous days.
 */
export async function publishDueAutoTrades(): Promise<AutoTradePublishSummary> {
  if (!env.AUTO_TRADES_ENABLED) {
    return { skipped: true, reason: "disabled", published: 0, alreadyPresent: 0 };
  }

  if (isPublishing) {
    return { skipped: true, reason: "busy", published: 0, alreadyPresent: 0 };
  }

  isPublishing = true;
  try {
    const clock = riyadhWallClock();
    if (clock.weekday === 0 || clock.weekday === 6) {
      return { skipped: true, reason: "weekend", published: 0, alreadyPresent: 0 };
    }

    const admin = await prisma.user.findFirst({
      where: { role: "ADMIN" },
      orderBy: { created_at: "asc" },
      select: { id: true },
    });
    if (!admin) {
      return { skipped: true, reason: "no_admin", published: 0, alreadyPresent: 0 };
    }

    const now = new Date();
    const slots = planForDay(clock.year, clock.month, clock.day);
    let published = 0;
    let alreadyPresent = 0;

    for (const slot of slots) {
      if (slot.scheduledAt > now) {
        continue;
      }

      const existing = await prisma.trade.findUnique({
        where: { auto_key: slot.autoKey },
        select: { id: true },
      });
      if (existing) {
        alreadyPresent += 1;
        continue;
      }

      try {
        await prisma.trade.create({
          data: {
            symbol: slot.symbol,
            side: slot.side,
            amount: slot.amount,
            outcome: "PROFITABLE",
            note: null,
            is_active: true,
            source: "AUTO",
            auto_key: slot.autoKey,
            created_by_admin_id: admin.id,
            created_at: slot.scheduledAt,
          },
        });
        published += 1;
      } catch (error) {
        if (isUniqueConstraintError(error)) {
          alreadyPresent += 1;
          continue;
        }
        throw error;
      }
    }

    return { skipped: false, published, alreadyPresent };
  } finally {
    isPublishing = false;
  }
}

/** Never fail a user/admin list because auto-publish had a transient error. */
export async function publishDueAutoTradesSafe(): Promise<void> {
  try {
    await publishDueAutoTrades();
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error("[autoTrade] Failed to publish due auto trades:", error);
  }
}
