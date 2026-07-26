import { prisma } from "../config/prisma";
import { ApiError } from "../utils/apiError";
import { add, toDecimalString } from "../utils/money";
import { buildReferralLink, maskEmail } from "../utils/referral";
import type { ReferralStatsQuery } from "../validators/referral.validator";

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
  /** Privacy-safe display email (e.g. jo***@example.com). */
  masked_email: string;
  display_name: string;
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
  /** Canonical snake_case fields (existing clients). */
  referral_code: string;
  referral_link: string;
  total_referrals: number;
  referrals_count: number;
  active_referrals: number;
  pending_referral_earnings: string;
  total_commission_earned: string;
  /** @deprecated Prefer `total_commission_earned`. */
  total_bonus_added_to_capital: string;
  referrals: ReferredUserSummary[];
  pagination: {
    limit: number;
    offset: number;
    total: number;
    has_more: boolean;
  };

  /** CamelCase aliases requested by the product API contract. */
  referralCode: string;
  referralLink: string;
  totalReferrals: number;
  referralsCount: number;
}

/**
 * Referrer dashboard stats: invite code/link, counts, pending/released
 * commissions, and a paginated list of referred users (masked emails).
 */
export async function getReferralStats(
  userId: string,
  query: ReferralStatsQuery = { limit: 50, offset: 0 }
): Promise<ReferralStats> {
  const user = await prisma.user.findUnique({ where: { id: userId } });

  if (!user) {
    throw ApiError.notFound("auth.user_not_found");
  }

  const { limit, offset } = query;

  const [totalReferrals, referredUsers, releasedAgg, rewards] = await Promise.all([
    prisma.user.count({ where: { referred_by_id: userId } }),
    prisma.user.findMany({
      where: { referred_by_id: userId },
      select: {
        id: true,
        email: true,
        created_at: true,
        status: true,
        investments: {
          orderBy: { start_date: "desc" },
          take: 1,
          select: {
            id: true,
            status: true,
            invested_amount: true,
            package: { select: { name: true } },
          },
        },
      },
      orderBy: { created_at: "desc" },
      take: limit,
      skip: offset,
    }),
    prisma.referralReward.aggregate({
      where: { referrer_id: userId, status: "APPROVED_RELEASED" },
      _sum: { bonus_amount: true },
    }),
    prisma.referralReward.findMany({
      where: { referrer_id: userId },
      orderBy: { created_at: "desc" },
      select: {
        id: true,
        referee_id: true,
        investment_id: true,
        expected_profit: true,
        bonus_amount: true,
        status: true,
      },
    }),
  ]);

  const STATUS_PRIORITY: Record<ReferralBonusState, number> = {
    PACKAGE_COMPLETED_AWAITING_ADMIN: 4,
    PENDING_PACKAGE_ACTIVE: 3,
    APPROVED_RELEASED: 2,
    REJECTED: 1,
    NONE: 0,
  };

  const rewardsByReferee = new Map<string, (typeof rewards)[number][]>();
  for (const reward of rewards) {
    const list = rewardsByReferee.get(reward.referee_id) ?? [];
    list.push(reward);
    rewardsByReferee.set(reward.referee_id, list);
  }

  const referrals: ReferredUserSummary[] = referredUsers.map((referee) => {
    const latestInvestment = referee.investments[0] ?? null;
    const hasActiveInvestment = latestInvestment?.status === "ACTIVE";
    const refereeRewards = rewardsByReferee.get(referee.id) ?? [];
    const local = referee.email.split("@")[0] || "user";

    // Sum all non-rejected commissions for this invitee (multiple packages).
    const openBonusTotal = refereeRewards
      .filter((reward) => reward.status !== "REJECTED")
      .reduce((sum, reward) => add(sum, reward.bonus_amount.toString()), "0.0000");

    const expectedProfitTotal = refereeRewards
      .filter((reward) => reward.status !== "REJECTED")
      .reduce((sum, reward) => add(sum, reward.expected_profit.toString()), "0.0000");

    let bonusStatus: ReferralBonusState = "NONE";
    for (const reward of refereeRewards) {
      const status = reward.status as ReferralBonusState;
      if (STATUS_PRIORITY[status] > STATUS_PRIORITY[bonusStatus]) {
        bonusStatus = status;
      }
    }

    return {
      id: referee.id,
      email: referee.email,
      masked_email: maskEmail(referee.email),
      display_name: local,
      registered_at: referee.created_at.toISOString(),
      account_status: referee.status,
      status: hasActiveInvestment ? "ACTIVE" : "INACTIVE",
      has_active_investment: hasActiveInvestment,
      package_name: latestInvestment?.package.name ?? null,
      package_amount: latestInvestment
        ? toDecimalString(latestInvestment.invested_amount.toString())
        : null,
      expected_profit: refereeRewards.length > 0 ? expectedProfitTotal : null,
      referral_bonus: refereeRewards.length > 0 ? openBonusTotal : null,
      bonus_status: bonusStatus,
    };
  });

  // Active referred users (distinct users with at least one ACTIVE package).
  const activeReferrals = await prisma.user.count({
    where: {
      referred_by_id: userId,
      investments: { some: { status: "ACTIVE" } },
    },
  });

  const totalCommission = toDecimalString(releasedAgg._sum.bonus_amount?.toString() ?? "0");
  const pendingEarnings = toDecimalString(user.pending_referral_bonus.toString());
  const count = user.referrals_count > 0 ? user.referrals_count : totalReferrals;
  const link = buildReferralLink(user.referral_code);

  return {
    referral_code: user.referral_code,
    referral_link: link,
    total_referrals: count,
    referrals_count: count,
    active_referrals: activeReferrals,
    pending_referral_earnings: pendingEarnings,
    total_commission_earned: totalCommission,
    total_bonus_added_to_capital: totalCommission,
    referrals,
    pagination: {
      limit,
      offset,
      total: totalReferrals,
      has_more: offset + referredUsers.length < totalReferrals,
    },
    referralCode: user.referral_code,
    referralLink: link,
    totalReferrals: count,
    referralsCount: count,
  };
}

/** Sum helper kept for callers that need to accumulate commission strings. */
export function sumCommissionAmounts(amounts: string[]): string {
  return amounts.reduce((sum, amount) => add(sum, amount), "0.0000");
}
