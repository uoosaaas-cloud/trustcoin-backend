import { api, type ApiSuccessResponse } from "./api";

export type ReferredUserStatus = "ACTIVE" | "INACTIVE";

export type ReferralBonusState =
  | "NONE"
  | "PENDING_PACKAGE_ACTIVE"
  | "PACKAGE_COMPLETED_AWAITING_ADMIN"
  | "APPROVED_RELEASED"
  | "REJECTED";

export interface ReferredUserSummary {
  id: string;
  email: string;
  masked_email?: string;
  display_name?: string;
  registered_at: string;
  account_status: string;
  status: ReferredUserStatus;
  has_active_investment: boolean;
  package_name: string | null;
  package_amount: string | null;
  expected_profit: string | null;
  referral_bonus: string | null;
  bonus_status: ReferralBonusState;
}

export interface ReferralStats {
  referral_code: string;
  referral_link: string;
  total_referrals: number;
  referrals_count?: number;
  active_referrals: number;
  pending_referral_earnings: string;
  total_commission_earned: string;
  /** @deprecated Prefer `total_commission_earned`. */
  total_bonus_added_to_capital?: string;
  referrals: ReferredUserSummary[];
  pagination?: {
    limit: number;
    offset: number;
    total: number;
    has_more: boolean;
  };
  referralCode?: string;
  referralLink?: string;
  totalReferrals?: number;
  referralsCount?: number;
}

export async function getReferralStats(params?: { limit?: number; offset?: number }) {
  const { data } = await api.get<ApiSuccessResponse<ReferralStats>>("/referrals/stats", {
    params,
  });
  return data;
}
