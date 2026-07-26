import { api, type ApiSuccessResponse } from "./api";

export type TransactionType = "DEPOSIT" | "WITHDRAWAL" | "PROFIT" | "REFERRAL";
export type TransactionStatus = "PENDING" | "COMPLETED" | "FAILED" | "APPROVED" | "REJECTED";

export interface TransactionRecord {
  id: string;
  user_id: string;
  amount: string;
  type: TransactionType;
  status: TransactionStatus;
  payment_address: string | null;
  tx_hash: string | null;
  note: string | null;
  created_at: string;
  updated_at: string;
}

export interface CreateWithdrawalPayload {
  amount: string;
  payment_address: string;
  note?: string;
  otp_code: string;
}

export async function listMyTransactions() {
  const { data } = await api.get<ApiSuccessResponse<TransactionRecord[]>>("/transactions/");
  return data;
}

export async function sendWithdrawalOtp() {
  const { data } = await api.post<ApiSuccessResponse<{ email: string; otpCode?: string }>>(
    "/transactions/withdraw/send-otp"
  );
  return data;
}

export async function createWithdrawal(payload: CreateWithdrawalPayload) {
  const { data } = await api.post<ApiSuccessResponse<TransactionRecord>>("/transactions/withdraw", payload);
  return data;
}
