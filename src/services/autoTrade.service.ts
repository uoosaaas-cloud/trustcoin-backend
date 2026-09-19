import { prisma } from "../config/prisma";
import { env } from "../config/env";
import { Prisma } from "@prisma/client";

const SYMBOLS = ["XAUUSD", "BTC"] as const;
const SIDES = ["BUY", "SELL"] as const;
const AMOUNT_MIN = 300_000;
const AMOUNT_MAX = 3_200_000;
const AMOUNT_STEP = 10_000;
const AMOUNT_STEP_COUNT = (AMOUNT_MAX - AMOUNT_MIN) / AMOUNT_STEP;
const TRADES_PER_DAY_MIN = 3;
const TRADES_PER_DAY_SPAN = 3;
/** Replay a few NY calendar days after deploys / sleeping hosts. */
const BACKFILL_DAYS = 8;
/** Spot FX closes Friday 17:00 New York and reopens Sunday 17:00 New York. */
const FOREX_WEEKEND_CUTOVER_MINUTES = 17 * 60;

const NY_CLOCK = new Intl.DateTimeFormat("en-US", {
  timeZone: "America/New_York",
  weekday: "short",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "numeric",
  minute: "numeric",
  hourCycle: "h23",
});

type NyWallClock = {
  weekday: string;
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
};

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

function pad2(value: number): string {
  return String(value).padStart(2, "0");
}

function nyWallClock(date: Date): NyWallClock {
  const parts = NY_CLOCK.formatToParts(date);
  const value = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((part) => part.type === type)?.value ?? "";
  return {
    weekday: value("weekday"),
    year: Number(value("year")),
    month: Number(value("month")),
    day: Number(value("day")),
    hour: Number(value("hour")),
    minute: Number(value("minute")),
  };
}

function nyLocalToUtc(year: number, month: number, day: number, hour: number, minute: number): Date {
  const target = Date.UTC(year, month - 1, day, hour, minute, 0, 0);
  let guess = target + 4 * 60 * 60 * 1000;
  for (let index = 0; index < 4; index += 1) {
    const shown = nyWallClock(new Date(guess));
    const shownAsUtc = Date.UTC(shown.year, shown.month - 1, shown.day, shown.hour, shown.minute);
    guess += target - shownAsUtc;
  }
  return new Date(guess);
}

/** Open minutes from NY midnight. Saturday is fully closed. */
function openWindowMinutes(weekday: string): { start: number; end: number } | null {
  if (weekday === "Sat") return null;
  if (weekday === "Sun") return { start: FOREX_WEEKEND_CUTOVER_MINUTES, end: 24 * 60 };
  if (weekday === "Fri") return { start: 0, end: FOREX_WEEKEND_CUTOVER_MINUTES };
  return { start: 0, end: 24 * 60 };
}

function isForexMarketOpen(date: Date): boolean {
  const clock = nyWallClock(date);
  const minutes = clock.hour * 60 + clock.minute;
  if (clock.weekday === "Sat") return false;
  if (clock.weekday === "Sun") return minutes >= FOREX_WEEKEND_CUTOVER_MINUTES;
  if (clock.weekday === "Fri") return minutes < FOREX_WEEKEND_CUTOVER_MINUTES;
  return true;
}

function dayKey(year: number, month: number, day: number): string {
  return `${year}-${pad2(month)}-${pad2(day)}`;
}

function planForNyDay(year: number, month: number, day: number, weekday: string): AutoTradeSlot[] {
  const window = openWindowMinutes(weekday);
  if (!window) return [];

  const span = window.end - window.start;
  if (span <= 0) return [];

  const key = dayKey(year, month, day);
  const random = mulberry32(hashDay(`trustcoin-auto-trades:${key}`));
  const count = TRADES_PER_DAY_MIN + Math.floor(random() * TRADES_PER_DAY_SPAN);
  const chosen = new Set<number>();
  let guard = 0;
  while (chosen.size < count && guard < 80) {
    chosen.add(window.start + Math.floor(random() * span));
    guard += 1;
  }

  return [...chosen]
    .sort((left, right) => left - right)
    .map((totalMinutes, index) => {
      const hour = Math.floor(totalMinutes / 60);
      const minute = totalMinutes % 60;
      return {
        autoKey: `${key}#${index}`,
        symbol: SYMBOLS[Math.floor(random() * SYMBOLS.length)],
        side: SIDES[Math.floor(random() * SIDES.length)],
        amount: AMOUNT_MIN + Math.floor(random() * (AMOUNT_STEP_COUNT + 1)) * AMOUNT_STEP,
        scheduledAt: nyLocalToUtc(year, month, day, hour, minute),
      };
    });
}

function dueSlots(now: Date): AutoTradeSlot[] {
  const seen = new Set<string>();
  const slots: AutoTradeSlot[] = [];

  for (let offset = 0; offset < BACKFILL_DAYS; offset += 1) {
    const clock = nyWallClock(new Date(now.getTime() - offset * 24 * 60 * 60 * 1000));
    const key = dayKey(clock.year, clock.month, clock.day);
    if (seen.has(key)) continue;
    seen.add(key);
    for (const slot of planForNyDay(clock.year, clock.month, clock.day, clock.weekday)) {
      if (slot.scheduledAt <= now) {
        slots.push(slot);
      }
    }
  }

  return slots;
}

function isUniqueConstraintError(error: unknown): boolean {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002";
}

/**
 * Inserts 3–5 AUTO trades per NY trading day, only after each slot's time.
 * Pauses for the global forex weekend (Fri 17:00 NY → Sun 17:00 NY).
 * Idempotent via auto_key. Backfills a few missed days after sleep/deploys.
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
    const marketOpen = isForexMarketOpen(now);
    const slots = dueSlots(now);

    if (slots.length === 0) {
      return {
        skipped: !marketOpen,
        reason: marketOpen ? undefined : "forex_weekend",
        published: 0,
        alreadyPresent: 0,
      };
    }

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
