import BigNumber from "bignumber.js";

// Never let JS floating point arithmetic touch money. All financial
// calculations (deposits, withdrawals, profit distribution, package
// returns) MUST go through this module.
BigNumber.set({ DECIMAL_PLACES: 20, ROUNDING_MODE: BigNumber.ROUND_DOWN });

export type Moneyish = string | number | BigNumber;

export function toBig(value: Moneyish): BigNumber {
  const big = value instanceof BigNumber ? value : new BigNumber(value);
  if (big.isNaN()) {
    throw new Error(`Invalid monetary value: ${String(value)}`);
  }
  return big;
}

/** Rounds down to 4 decimal places to match the Decimal(18,4) DB columns. */
export function toDecimalString(value: Moneyish): string {
  return toBig(value).decimalPlaces(4, BigNumber.ROUND_DOWN).toFixed(4);
}

export function add(a: Moneyish, b: Moneyish): string {
  return toDecimalString(toBig(a).plus(toBig(b)));
}

export function subtract(a: Moneyish, b: Moneyish): string {
  return toDecimalString(toBig(a).minus(toBig(b)));
}

export function multiply(a: Moneyish, b: Moneyish): string {
  return toDecimalString(toBig(a).multipliedBy(toBig(b)));
}

export function divide(a: Moneyish, b: Moneyish): string {
  return toDecimalString(toBig(a).dividedBy(toBig(b)));
}

export function isGreaterThanOrEqual(a: Moneyish, b: Moneyish): boolean {
  return toBig(a).isGreaterThanOrEqualTo(toBig(b));
}

export function isPositive(a: Moneyish): boolean {
  return toBig(a).isGreaterThan(0);
}

/**
 * Computes `percent`% of `amount`. `percent` is a plain percentage number,
 * e.g. 5 => 5%, 0.75 => 0.75%.
 */
export function percentOf(amount: Moneyish, percent: Moneyish): string {
  const percentAsFraction = toBig(percent).dividedBy(100);
  return toDecimalString(toBig(amount).multipliedBy(percentAsFraction));
}

/**
 * Computes the daily profit amount for an investment.
 * dailyProfitPercent is stored as a plain percentage number, e.g. 0.75 => 0.75%.
 */
export function calculateDailyProfit(currentAmount: Moneyish, dailyProfitPercent: Moneyish): string {
  return percentOf(currentAmount, dailyProfitPercent);
}
