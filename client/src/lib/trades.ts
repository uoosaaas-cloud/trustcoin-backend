import { api, type ApiSuccessResponse } from "./api";

export type TradeSide = "BUY" | "SELL";
export type TradeOutcome = "PROFITABLE" | "LOSS" | "PENDING";

export interface TradeItem {
  id: string;
  symbol: string;
  side: TradeSide;
  amount: string;
  outcome: TradeOutcome;
  note: string | null;
  isActive: boolean;
  createdByAdminId: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreateTradePayload {
  symbol: string;
  side: TradeSide;
  amount: number;
  outcome: TradeOutcome;
  note?: string | null;
  isActive?: boolean;
}

export type UpdateTradePayload = Partial<CreateTradePayload>;

export async function listUserTrades() {
  const { data } = await api.get<ApiSuccessResponse<TradeItem[]>>("/users/me/trades");
  return data;
}

export async function listAdminTrades() {
  const { data } = await api.get<ApiSuccessResponse<TradeItem[]>>("/admin/trades");
  return data;
}

export async function createAdminTrade(payload: CreateTradePayload) {
  const { data } = await api.post<ApiSuccessResponse<TradeItem>>("/admin/trades", payload);
  return data;
}

export async function updateAdminTrade(tradeId: string, payload: UpdateTradePayload) {
  const { data } = await api.patch<ApiSuccessResponse<TradeItem>>(`/admin/trades/${tradeId}`, payload);
  return data;
}

export async function deleteAdminTrade(tradeId: string) {
  const { data } = await api.delete<ApiSuccessResponse<{ id: string }>>(`/admin/trades/${tradeId}`);
  return data;
}
