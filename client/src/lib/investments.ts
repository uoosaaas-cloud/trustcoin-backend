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

export async function purchaseInvestment(payload: PurchaseInvestmentPayload) {
  const { data } = await api.post<ApiSuccessResponse<PurchaseInvestmentResponse>>(
    "/investments/purchase",
    payload
  );
  return data;
}

export type DurationKey = "duration7d" | "duration1m" | "duration3m" | "duration6m";

/** Maps package duration_days to i18n keys (7d / 1m / 3m / 6m). */
export function durationKey(days: number): DurationKey {
  if (days <= 7) return "duration7d";
  if (days <= 30) return "duration1m";
  if (days <= 90) return "duration3m";
  return "duration6m";
}

/**
 * Period return % for a package = daily rate × duration days.
 * Snaps near-integers so 4 d.p. daily storage still shows clean plan figures (e.g. 350%).
 */
export function getPeriodReturnPercent(pkg: Pick<InvestmentPackage, "daily_profit_percent" | "duration_days">): string {
  const daily = Number(pkg.daily_profit_percent);
  if (Number.isNaN(daily)) return "0";
  const raw = daily * pkg.duration_days;
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
