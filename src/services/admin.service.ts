import { prisma } from "../config/prisma";
import { env, isProduction } from "../config/env";
import { ApiError } from "../utils/apiError";
import { comparePassword } from "../utils/password";
import { signToken } from "../utils/jwt";
import { generateOtpCode, getOtpExpiryDate } from "../utils/otp";
import { add, isGreaterThanOrEqual, toDecimalString } from "../utils/money";
import { queueEmail, sendAdminLoginOtp, sendWithdrawalStatusEmail, sendKycReuploadRequest } from "./email.service";
import { consumeOtp } from "./otp.service";
import { resolveStoredIdDocument } from "../utils/upload";

/**
 * Step 1 of admin login: validate credentials, then issue a short-lived email OTP.
 * Does NOT return a JWT — the token is only issued after OTP verification.
 */
export async function loginAdmin(email: string, password: string) {
  const user = await prisma.user.findUnique({ where: { email } });

  if (!user || user.role !== "ADMIN") {
    throw ApiError.unauthorized("auth.invalid_credentials");
  }

  if (user.status !== "ACTIVE") {
    throw ApiError.forbidden("auth.account_suspended");
  }

  const passwordMatches = await comparePassword(password, user.password_hash);

  if (!passwordMatches) {
    throw ApiError.unauthorized("auth.invalid_credentials");
  }

  // Replace any prior unused admin-login OTPs for this email.
  await prisma.otpVerification.deleteMany({
    where: { email: user.email, purpose: "ADMIN_LOGIN" },
  });

  const code = generateOtpCode();
  const otp = await prisma.otpVerification.create({
    data: {
      email: user.email,
      code,
      purpose: "ADMIN_LOGIN",
      expires_at: getOtpExpiryDate(),
    },
  });

  queueEmail(() => sendAdminLoginOtp(user.email, code), `admin-login-otp:${user.email}`);

  return {
    requiresOtp: true as const,
    email: user.email,
    tempSessionId: otp.id,
    expiresInMinutes: env.OTP_EXPIRY_MINUTES,
    ...(!isProduction ? { otpCode: code } : {}),
  };
}

/**
 * Step 2 of admin login: consume ADMIN_LOGIN OTP and issue the admin JWT.
 */
export async function verifyAdminLoginOtp(email: string, code: string) {
  const user = await prisma.user.findUnique({ where: { email } });

  if (!user || user.role !== "ADMIN") {
    throw ApiError.unauthorized("auth.invalid_credentials");
  }

  if (user.status !== "ACTIVE") {
    throw ApiError.forbidden("auth.account_suspended");
  }

  await consumeOtp(user.email, code, "ADMIN_LOGIN");

  const token = signToken({ userId: user.id, role: user.role, language: user.language });
  return { user, token };
}

export async function logAdminAction(adminId: string, action: string, details?: string, userId?: string) {
  return prisma.adminLog.create({
    data: { admin_id: adminId, action, details, user_id: userId },
  });
}

export interface AdminOverviewStats {
  totalUsers: number;
  totalDeposits: string;
  totalWithdrawals: string;
  totalActiveInvestments: number;
  pendingWithdrawals: number;
}

/** Dashboard KPI aggregates for the admin overview. */
export async function getOverviewStats(): Promise<AdminOverviewStats> {
  const [totalUsers, depositAgg, withdrawalAgg, totalActiveInvestments, pendingWithdrawals] =
    await Promise.all([
      prisma.user.count({ where: { role: "USER" } }),
      prisma.transaction.aggregate({
        where: { type: { in: ["DEPOSIT", "GIFT"] }, status: "COMPLETED" },
        _sum: { amount: true },
      }),
      prisma.transaction.aggregate({
        where: { type: "WITHDRAWAL", status: "COMPLETED" },
        _sum: { amount: true },
      }),
      prisma.investment.count({ where: { status: "ACTIVE" } }),
      prisma.transaction.count({ where: { type: "WITHDRAWAL", status: "PENDING" } }),
    ]);

  return {
    totalUsers,
    totalDeposits: toDecimalString(depositAgg._sum.amount?.toString() ?? "0"),
    totalWithdrawals: toDecimalString(withdrawalAgg._sum.amount?.toString() ?? "0"),
    totalActiveInvestments,
    pendingWithdrawals,
  };
}

export interface AdminUserListItem {
  id: string;
  email: string;
  role: string;
  status: string;
  is_verified: boolean;
  language: string;
  referral_code: string;
  created_at: Date;
  id_passport_number: string | null;
  id_document_path: string | null;
  has_id_document: boolean;
  availableBalance: string;
  lockedBalance: string;
  totalBalance: string;
  activePackages: Array<{
    id: string;
    packageName: string;
    currentAmount: string;
    dailyProfitPercent: string;
    startDate: Date;
    endDate: Date;
  }>;
}

/**
 * Lists users with Available/Locked balances and active packages.
 * Optional `search` filters by email (contains). Optional `status` exact-match filter.
 */
export async function listUsers(search?: string, status?: string): Promise<AdminUserListItem[]> {
  const trimmedSearch = search?.trim();
  const trimmedStatus = status?.trim().toUpperCase();
  const statusFilter =
    trimmedStatus === "PENDING" || trimmedStatus === "ACTIVE" || trimmedStatus === "BLOCKED"
      ? trimmedStatus
      : undefined;

  // Unlock matured packages before reporting locked/available balances.
  const { settleOverdueInvestments } = await import("./investment.service");
  await settleOverdueInvestments();

  const users = await prisma.user.findMany({
    where: {
      ...(trimmedSearch ? { email: { contains: trimmedSearch } } : {}),
      ...(statusFilter ? { status: statusFilter } : {}),
    },
    select: {
      id: true,
      email: true,
      role: true,
      status: true,
      is_verified: true,
      language: true,
      referral_code: true,
      balance: true,
      created_at: true,
      id_passport_number: true,
      id_document_path: true,
      id_document_mime: true,
    },
    orderBy: { created_at: "desc" },
  });

  if (users.length === 0) {
    return [];
  }

  const userIds = users.map((u) => u.id);

  const [lockedGroups, activeInvestments] = await Promise.all([
    prisma.investment.groupBy({
      by: ["user_id"],
      where: { user_id: { in: userIds }, status: "ACTIVE" },
      _sum: { current_amount: true },
    }),
    prisma.investment.findMany({
      where: { user_id: { in: userIds }, status: "ACTIVE" },
      include: { package: { select: { name: true } } },
      orderBy: { start_date: "desc" },
    }),
  ]);

  const lockedByUser = new Map(
    lockedGroups.map((g) => [g.user_id, toDecimalString(g._sum.current_amount?.toString() ?? "0")])
  );

  const packagesByUser = new Map<string, AdminUserListItem["activePackages"]>();
  for (const inv of activeInvestments) {
    const list = packagesByUser.get(inv.user_id) ?? [];
    list.push({
      id: inv.id,
      packageName: inv.package.name,
      currentAmount: toDecimalString(inv.current_amount.toString()),
      dailyProfitPercent: toDecimalString(inv.daily_profit_percent.toString()),
      startDate: inv.start_date,
      endDate: inv.end_date,
    });
    packagesByUser.set(inv.user_id, list);
  }

  return users.map((user) => {
    const availableBalance = toDecimalString(user.balance.toString());
    const lockedBalance = lockedByUser.get(user.id) ?? "0.0000";
    return {
      id: user.id,
      email: user.email,
      role: user.role,
      status: user.status,
      is_verified: user.is_verified,
      language: user.language,
      referral_code: user.referral_code,
      created_at: user.created_at,
      id_passport_number: user.id_passport_number,
      id_document_path: user.id_document_path,
      has_id_document: Boolean(user.id_document_path || user.id_document_mime),
      availableBalance,
      lockedBalance,
      totalBalance: add(availableBalance, lockedBalance),
      activePackages: packagesByUser.get(user.id) ?? [],
    };
  });
}

export async function getUserIdDocument(userId: string): Promise<{ data: Buffer; mime: string }> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      role: true,
      id_document_path: true,
      id_document_mime: true,
      id_document_data: true,
    },
  });

  if (!user || user.role === "ADMIN") {
    throw ApiError.notFound("auth.user_not_found");
  }

  const stored = resolveStoredIdDocument({
    data: user.id_document_data ? Buffer.from(user.id_document_data) : null,
    mime: user.id_document_mime,
    path: user.id_document_path,
  });

  if (!stored) {
    throw ApiError.notFound("admin.id_document_missing");
  }

  return stored;
}

export async function requestIdDocumentReupload(userId: string, adminId: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, email: true, role: true, status: true },
  });
  if (!user) throw ApiError.notFound("auth.user_not_found");
  if (user.role === "ADMIN") throw ApiError.badRequest("errors.forbidden");

  queueEmail(() => sendKycReuploadRequest(user.email), `kyc-reupload:${user.email}`);
  await logAdminAction(adminId, "REQUEST_ID_REUPLOAD", `Asked ${user.email} to re-upload ID/passport photo`, userId);
  return { email: user.email };
}

export async function approveUser(userId: string, adminId: string) {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) throw ApiError.notFound("auth.user_not_found");
  if (user.role === "ADMIN") throw ApiError.badRequest("errors.forbidden");

  const updated = await prisma.user.update({
    where: { id: userId },
    data: { status: "ACTIVE", is_verified: true },
  });

  await logAdminAction(adminId, "APPROVE_USER", `Approved user ${user.email}`, userId);
  return updated;
}

export async function blockUser(userId: string, adminId: string) {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) throw ApiError.notFound("auth.user_not_found");
  if (user.role === "ADMIN") throw ApiError.badRequest("errors.forbidden");

  const updated = await prisma.user.update({
    where: { id: userId },
    data: { status: "BLOCKED" },
  });

  await logAdminAction(adminId, "BLOCK_USER", `Blocked user ${user.email}`, userId);
  return updated;
}

export async function deleteUser(userId: string, adminId: string) {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) throw ApiError.notFound("auth.user_not_found");
  if (user.role === "ADMIN") throw ApiError.badRequest("errors.forbidden");

  await logAdminAction(adminId, "DELETE_USER", `Deleted user ${user.email}`, userId);
  await prisma.user.delete({ where: { id: userId } });
  return { id: userId, email: user.email };
}

export interface AdminReferralAuditRow {
  id: string;
  status: string;
  bonus_percentage: string;
  expected_profit: string;
  bonus_amount: string;
  created_at: Date;
  updated_at: Date;
  canApprove: boolean;
  canReject: boolean;
  referrer: {
    id: string;
    email: string;
    display_name: string;
    referral_code: string;
    wallet_address: string | null;
    pending_referral_bonus: string;
  };
  referee: {
    id: string;
    email: string;
    display_name: string;
    status: string;
    registration_status: "SUCCESS" | "PENDING_KYC";
    is_verified: boolean;
    created_at: Date;
  };
  investment: {
    id: string;
    packageName: string;
    invested_amount: string;
    status: string;
    start_date: Date;
    end_date: Date;
  };
}

export interface AdminReferralOverview {
  totalReferrers: number;
  totalReferredUsers: number;
  totalCommissionPaid: string;
  totalPendingCommission: string;
  awaitingAdminCount: number;
  topReferrers: Array<{
    id: string;
    email: string;
    referral_code: string;
    referredCount: number;
    commissionEarned: string;
    pendingCommission: string;
  }>;
  auditRows: AdminReferralAuditRow[];
}

export async function getReferralAdminOverview(): Promise<AdminReferralOverview> {
  const [referredUsers, releasedRewards, pendingRewards, allRewards] = await Promise.all([
    prisma.user.findMany({
      where: { referred_by_id: { not: null } },
      select: { referred_by_id: true },
    }),
    prisma.referralReward.findMany({
      where: { status: "APPROVED_RELEASED" },
      select: { referrer_id: true, bonus_amount: true },
    }),
    prisma.referralReward.findMany({
      where: {
        status: { in: ["PENDING_PACKAGE_ACTIVE", "PACKAGE_COMPLETED_AWAITING_ADMIN"] },
      },
      select: { referrer_id: true, bonus_amount: true, status: true },
    }),
    prisma.referralReward.findMany({
      orderBy: [{ status: "asc" }, { created_at: "desc" }],
      include: {
        referrer: {
          select: {
            id: true,
            email: true,
            referral_code: true,
            pending_referral_bonus: true,
            depositAddresses: {
              select: { network: true, address: true },
              orderBy: { created_at: "asc" },
              take: 3,
            },
          },
        },
        referee: {
          select: {
            id: true,
            email: true,
            status: true,
            is_verified: true,
            created_at: true,
          },
        },
        investment: {
          select: {
            id: true,
            invested_amount: true,
            status: true,
            start_date: true,
            end_date: true,
            package: { select: { name: true } },
          },
        },
      },
    }),
  ]);

  const referredCountByReferrer = new Map<string, number>();
  for (const row of referredUsers) {
    if (!row.referred_by_id) continue;
    referredCountByReferrer.set(
      row.referred_by_id,
      (referredCountByReferrer.get(row.referred_by_id) ?? 0) + 1
    );
  }

  const commissionByReferrer = new Map<string, string>();
  let totalCommission = "0.0000";
  for (const reward of releasedRewards) {
    totalCommission = add(totalCommission, reward.bonus_amount.toString());
    commissionByReferrer.set(
      reward.referrer_id,
      add(commissionByReferrer.get(reward.referrer_id) ?? "0", reward.bonus_amount.toString())
    );
  }

  const pendingByReferrer = new Map<string, string>();
  let totalPending = "0.0000";
  let awaitingAdminCount = 0;
  for (const reward of pendingRewards) {
    totalPending = add(totalPending, reward.bonus_amount.toString());
    pendingByReferrer.set(
      reward.referrer_id,
      add(pendingByReferrer.get(reward.referrer_id) ?? "0", reward.bonus_amount.toString())
    );
    if (reward.status === "PACKAGE_COMPLETED_AWAITING_ADMIN") {
      awaitingAdminCount += 1;
    }
  }

  const topIds = [
    ...new Set([
      ...referredCountByReferrer.keys(),
      ...commissionByReferrer.keys(),
      ...pendingByReferrer.keys(),
    ]),
  ];
  const topUsers = topIds.length
    ? await prisma.user.findMany({
        where: { id: { in: topIds } },
        select: { id: true, email: true, referral_code: true },
      })
    : [];

  const topReferrers = topUsers
    .map((u) => ({
      id: u.id,
      email: u.email,
      referral_code: u.referral_code,
      referredCount: referredCountByReferrer.get(u.id) ?? 0,
      commissionEarned: toDecimalString(commissionByReferrer.get(u.id) ?? "0"),
      pendingCommission: toDecimalString(pendingByReferrer.get(u.id) ?? "0"),
    }))
    .sort(
      (a, b) =>
        Number(b.pendingCommission) - Number(a.pendingCommission) ||
        Number(b.commissionEarned) - Number(a.commissionEarned) ||
        b.referredCount - a.referredCount
    );

  const statusPriority: Record<string, number> = {
    PACKAGE_COMPLETED_AWAITING_ADMIN: 0,
    PENDING_PACKAGE_ACTIVE: 1,
    APPROVED_RELEASED: 2,
    REJECTED: 3,
  };

  const auditRows: AdminReferralAuditRow[] = allRewards
    .map((r) => {
      const wallet =
        r.referrer.depositAddresses.find((a) => a.network.toUpperCase().includes("TRC"))?.address ??
        r.referrer.depositAddresses[0]?.address ??
        null;

      return {
        id: r.id,
        status: r.status,
        bonus_percentage: toDecimalString(r.bonus_percentage.toString()),
        expected_profit: toDecimalString(r.expected_profit.toString()),
        bonus_amount: toDecimalString(r.bonus_amount.toString()),
        created_at: r.created_at,
        updated_at: r.updated_at,
        canApprove: r.status === "PACKAGE_COMPLETED_AWAITING_ADMIN",
        canReject: r.status === "PACKAGE_COMPLETED_AWAITING_ADMIN",
        referrer: {
          id: r.referrer.id,
          email: r.referrer.email,
          display_name: r.referrer.email.split("@")[0] || r.referrer.email,
          referral_code: r.referrer.referral_code,
          wallet_address: wallet,
          pending_referral_bonus: toDecimalString(r.referrer.pending_referral_bonus.toString()),
        },
        referee: {
          id: r.referee.id,
          email: r.referee.email,
          display_name: r.referee.email.split("@")[0] || r.referee.email,
          status: r.referee.status,
          registration_status: (r.referee.status === "ACTIVE" || r.referee.is_verified
            ? "SUCCESS"
            : "PENDING_KYC") as "SUCCESS" | "PENDING_KYC",
          is_verified: r.referee.is_verified,
          created_at: r.referee.created_at,
        },
        investment: {
          id: r.investment.id,
          packageName: r.investment.package.name,
          invested_amount: toDecimalString(r.investment.invested_amount.toString()),
          status: r.investment.status,
          start_date: r.investment.start_date,
          end_date: r.investment.end_date,
        },
      };
    })
    .sort(
      (a, b) =>
        (statusPriority[a.status] ?? 99) - (statusPriority[b.status] ?? 99) ||
        new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    );

  return {
    totalReferrers: topReferrers.length,
    totalReferredUsers: referredUsers.length,
    totalCommissionPaid: toDecimalString(totalCommission),
    totalPendingCommission: toDecimalString(totalPending),
    awaitingAdminCount,
    topReferrers: topReferrers.slice(0, 20),
    auditRows,
  };
}

export async function listAdminLogs() {
  return prisma.adminLog.findMany({
    orderBy: { created_at: "desc" },
    include: { admin: { select: { email: true } }, user: { select: { email: true } } },
  });
}

export async function listBannedIps() {
  return prisma.bannedIp.findMany({ orderBy: { banned_at: "desc" } });
}

export async function unbanIp(ipAddress: string) {
  const banned = await prisma.bannedIp.findUnique({ where: { ip_address: ipAddress } });

  if (!banned) {
    throw ApiError.notFound();
  }

  await prisma.bannedIp.delete({ where: { ip_address: ipAddress } });
}

export async function listPendingTransactions() {
  return prisma.transaction.findMany({
    where: { status: "PENDING" },
    include: { user: { select: { id: true, email: true } } },
    orderBy: { created_at: "asc" },
  });
}

/** Pending withdrawal requests only — used by the admin withdrawals table. */
export async function listPendingWithdrawals() {
  return prisma.transaction.findMany({
    where: { type: "WITHDRAWAL", status: "PENDING" },
    include: {
      user: {
        select: { id: true, email: true, status: true, balance: true },
      },
    },
    orderBy: { created_at: "asc" },
  });
}

/**
 * Rescue only: credits a leftover PENDING deposit ledger row.
 * Normal deposits auto-credit on-chain detection — admins should not need this.
 * Race-safe: claims PENDING → COMPLETED with updateMany before crediting.
 */
export async function approveDeposit(transactionId: string, adminId: string) {
  return prisma.$transaction(async (tx) => {
    const claimed = await tx.transaction.updateMany({
      where: { id: transactionId, type: "DEPOSIT", status: "PENDING" },
      data: { status: "COMPLETED" },
    });

    if (claimed.count !== 1) {
      throw ApiError.badRequest("transactions.not_found");
    }

    const transaction = await tx.transaction.findUniqueOrThrow({ where: { id: transactionId } });

    await tx.user.update({
      where: { id: transaction.user_id },
      data: { balance: { increment: transaction.amount } },
    });

    await tx.adminLog.create({
      data: {
        admin_id: adminId,
        user_id: transaction.user_id,
        action: "APPROVE_DEPOSIT",
        details: `Rescued leftover PENDING deposit of ${transaction.amount.toString()} (tx ${transaction.id})`,
      },
    });

    return transaction;
  });
}

/**
 * Rejects a pending withdrawal: claims PENDING → REJECTED atomically, then
 * refunds the reserved amount to Available Balance (increment, never RMW).
 */
export async function rejectWithdrawal(transactionId: string, adminId: string) {
  return prisma.$transaction(async (tx) => {
    const claimed = await tx.transaction.updateMany({
      where: { id: transactionId, type: "WITHDRAWAL", status: "PENDING" },
      data: { status: "REJECTED" },
    });

    if (claimed.count !== 1) {
      throw ApiError.badRequest("transactions.not_found");
    }

    const transaction = await tx.transaction.findUniqueOrThrow({ where: { id: transactionId } });

    await tx.user.update({
      where: { id: transaction.user_id },
      data: { balance: { increment: transaction.amount } },
    });

    await tx.adminLog.create({
      data: {
        admin_id: adminId,
        user_id: transaction.user_id,
        action: "REJECT_WITHDRAWAL",
        details: `Rejected withdrawal of ${transaction.amount.toString()} and refunded available balance (tx ${transaction.id})`,
      },
    });

    return transaction;
  }).then(async (transaction) => {
    const user = await prisma.user.findUnique({
      where: { id: transaction.user_id },
      select: { email: true },
    });
    if (user?.email) {
      queueEmail(
        () =>
          sendWithdrawalStatusEmail(
            user.email,
            toDecimalString(transaction.amount.toString()),
            "REJECTED",
            "تم رفض الطلب من الإدارة"
          ),
        `withdraw-rejected:${transaction.id}`
      );
    }
    return transaction;
  });
}

/**
 * Approves a pending withdrawal as COMPLETED in the ledger only.
 * On-chain USDT payout is manual (admin sends from master wallet).
 * Race-safe: only one concurrent call can claim PENDING → COMPLETED.
 */
export async function approveWithdrawal(transactionId: string, adminId: string) {
  return prisma.$transaction(async (tx) => {
    const claimed = await tx.transaction.updateMany({
      where: { id: transactionId, type: "WITHDRAWAL", status: "PENDING" },
      data: { status: "COMPLETED" },
    });

    if (claimed.count !== 1) {
      throw ApiError.badRequest("transactions.not_found");
    }

    const transaction = await tx.transaction.findUniqueOrThrow({ where: { id: transactionId } });

    await tx.adminLog.create({
      data: {
        admin_id: adminId,
        user_id: transaction.user_id,
        action: "APPROVE_WITHDRAWAL",
        details: `Approved withdrawal of ${transaction.amount.toString()} (tx ${transaction.id})`,
      },
    });

    return transaction;
  }).then(async (transaction) => {
    const user = await prisma.user.findUnique({
      where: { id: transaction.user_id },
      select: { email: true },
    });
    if (user?.email) {
      queueEmail(
        () =>
          sendWithdrawalStatusEmail(
            user.email,
            toDecimalString(transaction.amount.toString()),
            "APPROVED"
          ),
        `withdraw-approved:${transaction.id}`
      );
    }
    return transaction;
  });
}

// ---------------------------------------------------------------------------
// Referral & Investment Bonus Engine
// ---------------------------------------------------------------------------

export async function listPendingReferralRewards() {
  return prisma.referralReward.findMany({
    where: { status: "PACKAGE_COMPLETED_AWAITING_ADMIN" },
    include: {
      referrer: { select: { id: true, email: true, referral_code: true, pending_referral_bonus: true } },
      referee: { select: { id: true, email: true, status: true } },
      investment: {
        select: {
          id: true,
          invested_amount: true,
          status: true,
          end_date: true,
          package: { select: { name: true } },
        },
      },
    },
    orderBy: { updated_at: "asc" },
  });
}

/**
 * Releases a matured referral commission: moves funds from
 * pending_referral_bonus → available balance after package completion.
 */
export async function approveReferralReward(rewardId: string, adminId: string) {
  return prisma.$transaction(async (tx) => {
    const claimed = await tx.referralReward.updateMany({
      where: { id: rewardId, status: "PACKAGE_COMPLETED_AWAITING_ADMIN" },
      data: { status: "APPROVED_RELEASED", approved_by_admin_id: adminId },
    });

    if (claimed.count !== 1) {
      const existing = await tx.referralReward.findUnique({ where: { id: rewardId } });
      if (!existing) throw ApiError.notFound("referrals.reward_not_found");
      throw ApiError.badRequest("referrals.reward_not_ready");
    }

    const reward = await tx.referralReward.findUniqueOrThrow({ where: { id: rewardId } });
    const referrer = await tx.user.findUniqueOrThrow({
      where: { id: reward.referrer_id },
      select: { pending_referral_bonus: true },
    });

    const pending = toDecimalString(referrer.pending_referral_bonus.toString());
    const bonus = toDecimalString(reward.bonus_amount.toString());

    if (!isGreaterThanOrEqual(pending, bonus)) {
      throw ApiError.badRequest("referrals.insufficient_pending_bonus");
    }

    await tx.user.update({
      where: { id: reward.referrer_id },
      data: {
        pending_referral_bonus: { decrement: bonus },
        balance: { increment: bonus },
      },
    });

    const transaction = await tx.transaction.create({
      data: {
        user_id: reward.referrer_id,
        amount: bonus,
        type: "REFERRAL_BONUS_ADDED",
        status: "COMPLETED",
        tx_hash: `referral-release:${reward.id}`,
        note: `Referral commission released for reward ${reward.id} (25% of package profit)`,
      },
    });

    await tx.adminLog.create({
      data: {
        admin_id: adminId,
        user_id: reward.referrer_id,
        action: "APPROVE_REFERRAL_REWARD",
        details: `Released referral bonus of ${bonus} USDT (reward ${reward.id}) from pending → available`,
      },
    });

    return { reward, transaction };
  });
}

/** Rejects a matured referral commission and clears the pending lock. */
export async function rejectReferralReward(rewardId: string, adminId: string) {
  return prisma.$transaction(async (tx) => {
    const claimed = await tx.referralReward.updateMany({
      where: { id: rewardId, status: "PACKAGE_COMPLETED_AWAITING_ADMIN" },
      data: { status: "REJECTED", approved_by_admin_id: adminId },
    });

    if (claimed.count !== 1) {
      const existing = await tx.referralReward.findUnique({ where: { id: rewardId } });
      if (!existing) throw ApiError.notFound("referrals.reward_not_found");
      throw ApiError.badRequest("referrals.reward_not_ready");
    }

    const reward = await tx.referralReward.findUniqueOrThrow({ where: { id: rewardId } });
    const referrer = await tx.user.findUniqueOrThrow({
      where: { id: reward.referrer_id },
      select: { pending_referral_bonus: true },
    });

    const pending = toDecimalString(referrer.pending_referral_bonus.toString());
    const bonus = toDecimalString(reward.bonus_amount.toString());

    // Never wipe unrelated pending commissions — only clear this reward's lock.
    if (!isGreaterThanOrEqual(pending, bonus)) {
      throw ApiError.badRequest("referrals.insufficient_pending_bonus");
    }

    await tx.user.update({
      where: { id: reward.referrer_id },
      data: { pending_referral_bonus: { decrement: bonus } },
    });

    await tx.adminLog.create({
      data: {
        admin_id: adminId,
        user_id: reward.referrer_id,
        action: "REJECT_REFERRAL_REWARD",
        details: `Rejected referral bonus of ${bonus} USDT (reward ${reward.id}); pending lock cleared`,
      },
    });

    return reward;
  });
}

// ---------------------------------------------------------------------------
// Packages — dynamic profit rate control (no redeploy required)
// ---------------------------------------------------------------------------

export interface AdminPackageRow {
  id: string;
  name: string;
  amount: string;
  daily_profit_percent: string;
  duration_days: number;
  referral_bonus_1m: string;
  referral_bonus_3m: string;
  referral_bonus_6m: string;
  activeInvestments: number;
}

export async function listAdminPackages(): Promise<AdminPackageRow[]> {
  const packages = await prisma.package.findMany({
    orderBy: [{ amount: "asc" }, { duration_days: "asc" }],
    include: {
      _count: { select: { investments: { where: { status: "ACTIVE" } } } },
    },
  });

  return packages.map((pkg) => ({
    id: pkg.id,
    name: pkg.name,
    amount: toDecimalString(pkg.amount.toString()),
    daily_profit_percent: toDecimalString(pkg.daily_profit_percent.toString()),
    duration_days: pkg.duration_days,
    referral_bonus_1m: toDecimalString(pkg.referral_bonus_1m.toString()),
    referral_bonus_3m: toDecimalString(pkg.referral_bonus_3m.toString()),
    referral_bonus_6m: toDecimalString(pkg.referral_bonus_6m.toString()),
    activeInvestments: pkg._count.investments,
  }));
}

export async function updateAdminPackage(
  packageId: string,
  adminId: string,
  input: {
    daily_profit_percent?: string;
    amount?: string;
    duration_days?: number;
    name?: string;
    referral_bonus_1m?: string;
    referral_bonus_3m?: string;
    referral_bonus_6m?: string;
  }
) {
  const existing = await prisma.package.findUnique({ where: { id: packageId } });
  if (!existing) {
    throw ApiError.notFound("investments.package_not_found");
  }

  const updated = await prisma.package.update({
    where: { id: packageId },
    data: {
      ...(input.daily_profit_percent !== undefined
        ? { daily_profit_percent: toDecimalString(input.daily_profit_percent) }
        : {}),
      ...(input.amount !== undefined ? { amount: toDecimalString(input.amount) } : {}),
      ...(input.duration_days !== undefined ? { duration_days: input.duration_days } : {}),
      ...(input.name !== undefined ? { name: input.name.trim() } : {}),
      ...(input.referral_bonus_1m !== undefined
        ? { referral_bonus_1m: toDecimalString(input.referral_bonus_1m) }
        : {}),
      ...(input.referral_bonus_3m !== undefined
        ? { referral_bonus_3m: toDecimalString(input.referral_bonus_3m) }
        : {}),
      ...(input.referral_bonus_6m !== undefined
        ? { referral_bonus_6m: toDecimalString(input.referral_bonus_6m) }
        : {}),
    },
  });

  await logAdminAction(
    adminId,
    "UPDATE_PACKAGE",
    `Updated package ${updated.name} (${updated.id}): daily_profit_percent=${updated.daily_profit_percent.toString()}%`
  );

  return {
    id: updated.id,
    name: updated.name,
    amount: toDecimalString(updated.amount.toString()),
    daily_profit_percent: toDecimalString(updated.daily_profit_percent.toString()),
    duration_days: updated.duration_days,
    referral_bonus_1m: toDecimalString(updated.referral_bonus_1m.toString()),
    referral_bonus_3m: toDecimalString(updated.referral_bonus_3m.toString()),
    referral_bonus_6m: toDecimalString(updated.referral_bonus_6m.toString()),
    note: "New purchases use the updated rate. Active investments keep their snapshotted rate.",
  };
}

// ---------------------------------------------------------------------------
// Deposit monitoring — sub-wallets, claims, sweeps, master wallets
// ---------------------------------------------------------------------------

export interface AdminDepositMonitoring {
  systemWallets: {
    TRC20: string;
    BEP20: string;
    ERC20: string;
  };
  summary: {
    pendingClaims: number;
    approvedClaims: number;
    subWallets: number;
    recentSweepSuccess: number;
    recentSweepFailed: number;
  };
  pendingClaims: Array<{
    id: string;
    amount: string;
    network: string;
    status: string;
    tx_hash: string | null;
    proof_image: string | null;
    created_at: Date;
    user: { id: string; email: string; status: string };
    depositAddress: string | null;
  }>;
  /** Recently credited deposits (APPROVED claims) — what users see in deposit history. */
  recentApprovedClaims: Array<{
    id: string;
    amount: string;
    network: string;
    status: string;
    tx_hash: string | null;
    sweep_tx_hash: string | null;
    swept_at: Date | null;
    created_at: Date;
    user: { id: string; email: string; status: string };
    depositAddress: string | null;
  }>;
  subWallets: Array<{
    id: string;
    network: string;
    address: string;
    last_sweep_status: string | null;
    last_sweep_tx_hash: string | null;
    last_swept_at: Date | null;
    created_at: Date;
    user: { id: string; email: string };
  }>;
  recentSweeps: Array<{
    id: string;
    network: string;
    amount_usdt: string;
    from_address: string;
    to_address: string;
    sweep_tx_hash: string | null;
    gas_topup_tx_hash: string | null;
    status: string;
    error_message: string | null;
    created_at: Date;
  }>;
}

export async function getDepositMonitoringOverview(): Promise<AdminDepositMonitoring> {
  // Ensure exceptional/manual ledger credits appear in deposit history tables.
  const { reconcileOrphanDepositLedgerEntries } = await import("./deposit.service");
  await reconcileOrphanDepositLedgerEntries();

  const [
    pendingClaimsCount,
    approvedClaimsCount,
    subWalletCount,
    recentSweepSuccess,
    recentSweepFailed,
    pendingClaims,
    recentApprovedClaims,
    subWallets,
    recentSweeps,
  ] = await Promise.all([
    prisma.depositRequest.count({ where: { status: "PENDING" } }),
    prisma.depositRequest.count({ where: { status: "APPROVED" } }),
    prisma.userDepositAddress.count(),
    prisma.depositSweep.count({ where: { status: "SUCCESS" } }),
    prisma.depositSweep.count({ where: { status: "FAILED" } }),
    prisma.depositRequest.findMany({
      where: { status: "PENDING" },
      orderBy: { created_at: "desc" },
      take: 50,
      include: {
        user: { select: { id: true, email: true, status: true } },
        depositAddress: { select: { address: true } },
      },
    }),
    prisma.depositRequest.findMany({
      where: { status: "APPROVED" },
      orderBy: { created_at: "desc" },
      take: 50,
      include: {
        user: { select: { id: true, email: true, status: true } },
        depositAddress: { select: { address: true } },
      },
    }),
    prisma.userDepositAddress.findMany({
      orderBy: { created_at: "desc" },
      take: 100,
      select: {
        id: true,
        network: true,
        address: true,
        last_sweep_status: true,
        last_sweep_tx_hash: true,
        last_swept_at: true,
        created_at: true,
        user: { select: { id: true, email: true } },
      },
    }),
    prisma.depositSweep.findMany({
      orderBy: { created_at: "desc" },
      take: 50,
      select: {
        id: true,
        network: true,
        amount_usdt: true,
        from_address: true,
        to_address: true,
        sweep_tx_hash: true,
        gas_topup_tx_hash: true,
        status: true,
        error_message: true,
        created_at: true,
      },
    }),
  ]);

  return {
    systemWallets: {
      TRC20: env.DEPOSIT_WALLET_TRC20,
      BEP20: env.DEPOSIT_WALLET_BEP20,
      ERC20: env.DEPOSIT_WALLET_ERC20,
    },
    summary: {
      pendingClaims: pendingClaimsCount,
      approvedClaims: approvedClaimsCount,
      subWallets: subWalletCount,
      recentSweepSuccess,
      recentSweepFailed,
    },
    pendingClaims: pendingClaims.map((c) => ({
      id: c.id,
      amount: toDecimalString(c.amount.toString()),
      network: c.network,
      status: c.status,
      tx_hash: c.tx_hash,
      proof_image: c.proof_image,
      created_at: c.created_at,
      user: c.user,
      depositAddress: c.depositAddress?.address ?? null,
    })),
    recentApprovedClaims: recentApprovedClaims.map((c) => ({
      id: c.id,
      amount: toDecimalString(c.amount.toString()),
      network: c.network,
      status: c.status,
      tx_hash: c.tx_hash,
      sweep_tx_hash: c.sweep_tx_hash,
      swept_at: c.swept_at,
      created_at: c.created_at,
      user: c.user,
      depositAddress: c.depositAddress?.address ?? null,
    })),
    subWallets: subWallets.map((w) => ({
      id: w.id,
      network: w.network,
      address: w.address,
      last_sweep_status: w.last_sweep_status,
      last_sweep_tx_hash: w.last_sweep_tx_hash,
      last_swept_at: w.last_swept_at,
      created_at: w.created_at,
      user: w.user,
    })),
    recentSweeps: recentSweeps.map((s) => ({
      id: s.id,
      network: s.network,
      amount_usdt: toDecimalString(s.amount_usdt.toString()),
      from_address: s.from_address,
      to_address: s.to_address,
      sweep_tx_hash: s.sweep_tx_hash,
      gas_topup_tx_hash: s.gas_topup_tx_hash,
      status: s.status,
      error_message: s.error_message,
      created_at: s.created_at,
    })),
  };
}
