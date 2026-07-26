import { api, type ApiSuccessResponse } from "./api";

export interface WalletBalanceSummary {
  availableBalance: string;
  lockedBalance: string;
  totalBalance: string;
  pendingWithdrawalBalance: string;
  /** Locked referral commissions awaiting package maturity + admin release. */
  pendingReferralBonus: string;
  currency: "USDT";
}

export async function getMyWallet() {
  const { data } = await api.get<ApiSuccessResponse<WalletBalanceSummary>>("/users/me/wallet");
  return data;
}
