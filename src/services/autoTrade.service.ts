import { prisma } from "../config/prisma";
import { env } from "../config/env";
import { Prisma } from "@prisma/client";

const SYMBOLS = ["XAUUSD", "BTC"] as const;
const SIDES = ["BUY", "SELL"] as const;
const AMOUNT_MIN = 300_000;
const AMOUNT_MAX = 3_200_000;
const AMOUNT_STEP = 10_000;
const AMOUNT_STEP_COUNT = (AMOUNT_MAX - AMOUNT_MIN) / AMOUNT_STEP;

/** One AUTO row per tick, matching the cron cadence. */
const TICK_MS = 15 * 60 * 1000;
/** Replay missed ticks after deploys / sleeping Render dynos. */
const BACKFILL_MS = 36 * 60 * 60 * 1000;

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

function floorToTick(date: Date): Date {
  return new Date(Math.floor(date.getTime() / TICK_MS) * TICK_MS);
}

/** Compact UTC key, e.g. t202609191045 — fits trades.auto_key VARCHAR(32). */
function autoKeyForTick(at: Date): string {
  const year = at.getUTCFullYear();
  const month = String(at.getUTCMonth() + 1).padStart(2, "0");
  const day = String(at.getUTCDate()).padStart(2, "0");
  const hour = String(at.getUTCHours()).padStart(2, "0");
  const minute = String(at.getUTCMinutes()).padStart(2, "0");
  return `t${year}${month}${day}${hour}${minute}`;
}

function planTick(at: Date): AutoTradeSlot {
  const autoKey = autoKeyForTick(at);
  const random = mulberry32(hashDay(`trustcoin-auto-trades:${autoKey}`));
  return {
    autoKey,
    symbol: SYMBOLS[Math.floor(random() * SYMBOLS.length)],
    side: SIDES[Math.floor(random() * SIDES.length)],
    amount: AMOUNT_MIN + Math.floor(random() * (AMOUNT_STEP_COUNT + 1)) * AMOUNT_STEP,
    scheduledAt: at,
  };
}

function dueTicks(now: Date): Date[] {
  const latest = floorToTick(now);
  const earliest = new Date(latest.getTime() - BACKFILL_MS);
  const ticks: Date[] = [];
  for (let at = earliest.getTime(); at <= latest.getTime(); at += TICK_MS) {
    ticks.push(new Date(at));
  }
  return ticks;
}

function isUniqueConstraintError(error: unknown): boolean {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002";
}

/**
 * Inserts due AUTO trades for the last 36 hours (15-minute ticks, 24/7).
 * Weekends and overnight hours are included — the board must keep moving.
 * Idempotent via auto_key. Safe after sleeping hosts / deploys.
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
    const now = new Date();
    const slots = dueTicks(now).map(planTick);
    const keys = slots.map((slot) => slot.autoKey);

    const existingRows = await prisma.trade.findMany({
      where: { auto_key: { in: keys } },
      select: { auto_key: true },
    });
    const existingKeys = new Set(
      existingRows.map((row) => row.auto_key).filter((key): key is string => Boolean(key))
    );

    let published = 0;
    let alreadyPresent = existingKeys.size;
    const missing = slots.filter((slot) => !existingKeys.has(slot.autoKey));

    if (missing.length > 0) {
      try {
        const result = await prisma.trade.createMany({
          data: missing.map((slot) => ({
            symbol: slot.symbol,
            side: slot.side,
            amount: slot.amount,
            outcome: "PROFITABLE" as const,
            note: null,
            is_active: true,
            source: "AUTO" as const,
            auto_key: slot.autoKey,
            created_at: slot.scheduledAt,
          })),
          skipDuplicates: true,
        });
        published = result.count;
        alreadyPresent += missing.length - published;
      } catch (error) {
        if (!isUniqueConstraintError(error)) {
          throw error;
        }
        alreadyPresent += missing.length;
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
