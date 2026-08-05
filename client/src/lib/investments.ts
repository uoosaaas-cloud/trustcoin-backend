import { api, type ApiSuccessResponse } from "./api";
import type { WalletBalanceSummary } from "./wallet";

export interface InvestmentPackage {
  id: string;
  name: string;
  /** Fixed package purchase price (USDT). */
  amount: string;
  daily_profit_percent: string;
  duration_days: number;
  referral_bonus_1m: string;
  referral_bonus_3m: string;
  referral_bonus_6m: string;
}

export interface InvestmentRecord {
  id: string;
  user_id: string;
  package_id: string;
  invested_amount: string;
  base_amount: string;
  current_amount: string;
  daily_profit_percent: string;
  total_earned: string;
  status: "ACTIVE" | "COMPLETED";
  start_date: string;
  end_date: string;
  package: InvestmentPackage;
}

export interface PurchaseInvestmentPayload {
  packageId: string;
  /** Optional; must match the package's fixed `amount` when sent. */
  amount?: string;
}

export interface PurchaseInvestmentResponse {
  investment: InvestmentRecord;
  wallet: WalletBalanceSummary;
}

export async function getInvestmentPackages() {
  const { data } = await api.get<ApiSuccessResponse<InvestmentPackage[]>>("/investments/packages");
  return data;
}

/** Current user's investments (active + completed), newest first. */
export async function getMyInvestments() {
  const { data } = await api.get<ApiSuccessResponse<InvestmentRecord[]>>("/investments/my");
  return data;
}

/** Estimated daily profit in USDT for an investment position. */
export function getDailyProfitUsdt(
  inv: Pick<InvestmentRecord, "current_amount" | "daily_profit_percent">
): number {
  const amount = Number(inv.current_amount);
  const rate = Number(inv.daily_profit_percent);
  if (!Number.isFinite(amount) || !Number.isFinite(rate)) return 0;
  return (amount * rate) / 100;
}

/** Progress 0–100 through the lock window (clamped). */
export function getInvestmentProgress(
  inv: Pick<InvestmentRecord, "start_date" | "end_date" | "status">
): number {
  if (inv.status === "COMPLETED") return 100;
  const start = new Date(inv.start_date).getTime();
  const end = new Date(inv.end_date).getTime();
  const now = Date.now();
  if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) return 0;
  return Math.min(100, Math.max(0, ((now - start) / (end - start)) * 100));
}

/** Whole days remaining until maturity (0 when completed/past). */
export function getDaysRemaining(
  inv: Pick<InvestmentRecord, "end_date" | "status">
): number {
  if (inv.status === "COMPLETED") return 0;
  const end = new Date(inv.end_date).getTime();
  if (!Number.isFinite(end)) return 0;
  return Math.max(0, Math.ceil((end - Date.now()) / 86_400_000));
}

/** Accrual display step for live total earned (6 hours). */
export const EARNINGS_ACCRUAL_STEP_MS = 6 * 60 * 60 * 1000;

/** Ms until the next 6-hour accrual step from package start. */
export function msUntilNextEarningsStep(startDate: string, nowMs = Date.now()): number {
  const start = new Date(startDate).getTime();
  if (!Number.isFinite(start) || nowMs <= start) return 0;
  const elapsed = nowMs - start;
  return EARNINGS_ACCRUAL_STEP_MS - (elapsed % EARNINGS_ACCRUAL_STEP_MS);
}

/**
 * Live accruing total earned for active packages.
 * Advances in 6-hour steps from start, never below server total_earned.
 */
export function getLiveTotalEarned(
  inv: Pick<
    InvestmentRecord,
    "status" | "start_date" | "end_date" | "current_amount" | "daily_profit_percent" | "total_earned"
  >,
  nowMs = Date.now()
): number {
  const serverTotal = Number(inv.total_earned);
  if (inv.status !== "ACTIVE") {
    return Number.isFinite(serverTotal) ? serverTotal : 0;
  }

  const start = new Date(inv.start_date).getTime();
  const end = new Date(inv.end_date).getTime();
  const amount = Number(inv.current_amount);
  const dailyPct = Number(inv.daily_profit_percent);

  if (
    !Number.isFinite(start) ||
    !Number.isFinite(end) ||
    !Number.isFinite(amount) ||
    !Number.isFinite(dailyPct) ||
    end <= start
  ) {
    return Number.isFinite(serverTotal) ? serverTotal : 0;
  }

  const elapsedMs = Math.min(Math.max(0, nowMs - start), end - start);
  const steppedMs =
    Math.floor(elapsedMs / EARNINGS_ACCRUAL_STEP_MS) * EARNINGS_ACCRUAL_STEP_MS;
  const elapsedDays = steppedMs / 86_400_000;
  const projected = amount * (dailyPct / 100) * elapsedDays;
  const safeServer = Number.isFinite(serverTotal) ? serverTotal : 0;
  return Math.max(safeServer, projected);
}

export async function purchaseInvestment(payload: PurchaseInvestmentPayload) {
  const { data } = await api.post<ApiSuccessResponse<PurchaseInvestmentResponse>>(
    "/investments/purchase",
    payload
  );
  return data;
}

export type DurationKey = "duration7d" | "duration1m" | "duration3m" | "duration6m";

/**
 * Maps package duration_days to i18n keys (7d / 1m / 3m / 6m).
 * Uses exact known plan lengths first so a 7-day package never
 * falls into the 1-month bucket.
 */
export function durationKey(days: number): DurationKey {
  const d = Math.round(Number(days));
  if (!Number.isFinite(d) || d <= 0) return "duration1m";

  if (d === 7) return "duration7d";
  if (d === 30) return "duration1m";
  if (d === 90) return "duration3m";
  if (d === 180) return "duration6m";

  // Nearest bucket for any unexpected duration values.
  if (d <= 10) return "duration7d";
  if (d <= 45) return "duration1m";
  if (d <= 120) return "duration3m";
  return "duration6m";
}

/** Prefer exact duration_days; fall back to package name hints. */
export function durationKeyFromPackage(pkg: {
  duration_days: number;
  name?: string;
}): DurationKey {
  const name = (pkg.name ?? "").toLowerCase();
  if (/\b7\s*days?\b/.test(name) || name.includes("7-day")) {
    return "duration7d";
  }
  if (/\b1\s*month\b/.test(name)) return "duration1m";
  if (/\b3\s*months?\b/.test(name)) return "duration3m";
  if (/\b6\s*months?\b/.test(name)) return "duration6m";
  return durationKey(pkg.duration_days);
}

/**
 * Period return % for a package = daily rate × duration days.
 * Snaps near-integers so 4 d.p. daily storage still shows clean plan figures (e.g. 350%).
 */
export function getPeriodReturnPercent(
  pkg: Pick<InvestmentPackage, "daily_profit_percent" | "duration_days">
): string {
  const daily = Number(pkg.daily_profit_percent);
  const days = Number(pkg.duration_days);
  if (!Number.isFinite(daily) || !Number.isFinite(days) || days <= 0) return "0";
  const raw = daily * days;
  const twoDp = Math.round(raw * 100) / 100;
  if (Math.abs(twoDp - Math.round(twoDp)) < 0.02) {
    return String(Math.round(twoDp));
  }
  return twoDp.toFixed(2);
}

/** Groups fixed-amount packages into amount tiers for the invest UI. */
export function groupPackagesByTier(packages: InvestmentPackage[]) {
  const sorted = [...packages].sort(
    (a, b) => Number(a.amount) - Number(b.amount) || a.duration_days - b.duration_days
  );

  const tierAmounts = [...new Set(sorted.map((pkg) => pkg.amount))].sort(
    (a, b) => Number(a) - Number(b)
  );

  return tierAmounts.map((amount) => ({
    amount,
    variants: sorted.filter((pkg) => pkg.amount === amount),
  }));
}
