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

/**
 * Period return % for a package = daily rate × duration days
 * (shown as monthly / 3-month / 6-month depending on `duration_days`).
 */
export function getPeriodReturnPercent(pkg: Pick<InvestmentPackage, "daily_profit_percent" | "duration_days">): string {
  const daily = Number(pkg.daily_profit_percent);
  if (Number.isNaN(daily)) return "0.00";
  return (daily * pkg.duration_days).toFixed(2);
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
