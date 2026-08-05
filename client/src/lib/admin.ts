import { api, type ApiSuccessResponse } from "./api";
import { persistAuthSession, type AuthUser, type LoginPayload } from "./auth";

export interface AdminOverviewStats {
  totalUsers: number;
  totalDeposits: string;
  totalWithdrawals: string;
  totalActiveInvestments: number;
  pendingWithdrawals: number;
}

export interface AdminActivePackage {
  id: string;
  packageName: string;
  currentAmount: string;
  dailyProfitPercent: string;
  startDate: string;
  endDate: string;
}

export interface AdminUserListItem {
  id: string;
  email: string;
  role: string;
  status: string;
  is_verified: boolean;
  language: string;
  referral_code: string;
  created_at: string;
  id_passport_number: string | null;
  id_document_path: string | null;
  availableBalance: string;
  lockedBalance: string;
  totalBalance: string;
  activePackages: AdminActivePackage[];
}

export type AdminReferralRewardStatus =
  | "PENDING_PACKAGE_ACTIVE"
  | "PACKAGE_COMPLETED_AWAITING_ADMIN"
  | "APPROVED_RELEASED"
  | "REJECTED";

export interface AdminReferralAuditRow {
  id: string;
  status: AdminReferralRewardStatus | string;
  bonus_percentage: string;
  expected_profit: string;
  bonus_amount: string;
  created_at: string;
  updated_at: string;
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
    created_at: string;
  };
  investment: {
    id: string;
    packageName: string;
    invested_amount: string;
    status: string;
    start_date: string;
    end_date: string;
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

export interface AdminPendingWithdrawal {
  id: string;
  user_id: string;
  amount: string;
  type: "WITHDRAWAL";
  status: "PENDING";
  payment_address: string | null;
  network: string | null;
  note: string | null;
  created_at: string;
  user: {
    id: string;
    email: string;
    status: string;
    balance: string;
  };
}

export interface AdminLoginChallenge {
  requiresOtp: true;
  email: string;
  tempSessionId: string;
  expiresInMinutes: number;
  /** Present only outside production for local testing. */
  otpCode?: string;
}

export interface AdminLoginSuccess {
  token: string;
  user: { id: string; email: string; role: "ADMIN" };
}

/** Step 1: credentials only — returns OTP challenge, never a JWT. */
export async function loginAdmin(payload: LoginPayload) {
  const { data } = await api.post<ApiSuccessResponse<AdminLoginChallenge>>("/admin/login", payload);
  return data;
}

/** Step 2: verify email OTP and persist the admin session. */
export async function verifyAdminLoginOtp(payload: { email: string; code: string }) {
  const { data } = await api.post<ApiSuccessResponse<AdminLoginSuccess>>(
    "/admin/verify-login-otp",
    payload
  );

  const user: AuthUser = {
    id: data.data.user.id,
    email: data.data.user.email,
    role: "ADMIN",
    balance: "0",
    language: "en",
  };

  persistAuthSession({ token: data.data.token, user });
  return data;
}

export async function getAdminOverview() {
  const { data } = await api.get<ApiSuccessResponse<AdminOverviewStats>>("/admin/overview");
  return data;
}

export async function getAdminUsers(search?: string, status?: string) {
  const { data } = await api.get<ApiSuccessResponse<AdminUserListItem[]>>("/admin/users", {
    params: {
      ...(search?.trim() ? { search: search.trim() } : {}),
      ...(status?.trim() ? { status: status.trim() } : {}),
    },
  });
  return data;
}

export async function approveAdminUser(userId: string) {
  const { data } = await api.post<ApiSuccessResponse<unknown>>(`/admin/users/${userId}/approve`);
  return data;
}

export async function blockAdminUser(userId: string) {
  const { data } = await api.post<ApiSuccessResponse<unknown>>(`/admin/users/${userId}/block`);
  return data;
}

export async function deleteAdminUser(userId: string) {
  const { data } = await api.delete<ApiSuccessResponse<unknown>>(`/admin/users/${userId}`);
  return data;
}

export async function getAdminReferralOverview() {
  const { data } = await api.get<ApiSuccessResponse<AdminReferralOverview>>("/admin/referrals/overview");
  return data;
}

export async function approveAdminReferral(rewardId: string) {
  const { data } = await api.post<ApiSuccessResponse<unknown>>(`/admin/referrals/${rewardId}/approve`);
  return data;
}

export async function rejectAdminReferral(rewardId: string) {
  const { data } = await api.post<ApiSuccessResponse<unknown>>(`/admin/referrals/${rewardId}/reject`);
  return data;
}

export async function getPendingWithdrawals() {
  const { data } = await api.get<ApiSuccessResponse<AdminPendingWithdrawal[]>>("/admin/withdrawals/pending");
  return data;
}

export async function approveWithdrawal(transactionId: string) {
  const { data } = await api.post<ApiSuccessResponse<unknown>>(
    `/admin/transactions/${transactionId}/approve-withdrawal`
  );
  return data;
}

export async function rejectWithdrawal(transactionId: string) {
  const { data } = await api.post<ApiSuccessResponse<unknown>>(
    `/admin/transactions/${transactionId}/reject-withdrawal`
  );
  return data;
}

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

export interface AdminDepositMonitoring {
  systemWallets: { TRC20: string; BEP20: string; ERC20: string };
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
    created_at: string;
    user: { id: string; email: string; status: string };
    depositAddress: string | null;
  }>;
  subWallets: Array<{
    id: string;
    network: string;
    address: string;
    last_sweep_status: string | null;
    last_sweep_tx_hash: string | null;
    last_swept_at: string | null;
    created_at: string;
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
    created_at: string;
  }>;
}

export async function getAdminPackages() {
  const { data } = await api.get<ApiSuccessResponse<AdminPackageRow[]>>("/admin/packages");
  return data;
}

export async function updateAdminPackage(
  packageId: string,
  payload: Partial<{
    daily_profit_percent: string;
    amount: string;
    duration_days: number;
    name: string;
  }>
) {
  const { data } = await api.patch<ApiSuccessResponse<AdminPackageRow & { note?: string }>>(
    `/admin/packages/${packageId}`,
    payload
  );
  return data;
}

export async function getAdminDepositMonitoring() {
  const { data } = await api.get<ApiSuccessResponse<AdminDepositMonitoring>>("/admin/deposits/monitoring");
  return data;
}

export async function triggerAdminDepositSweep(payload?: {
  depositAddressId?: string;
  address?: string;
  network?: string;
  dryRun?: boolean;
  force?: boolean;
}) {
  const { data } = await api.post<ApiSuccessResponse<unknown>>("/admin/deposits/trigger-sweep", payload ?? {});
  return data;
}
