import { api, type ApiSuccessResponse } from "./api";

export const DEPOSIT_NETWORKS = ["TRC20", "BEP20", "ERC20"] as const;
export type DepositNetworkCode = (typeof DEPOSIT_NETWORKS)[number];

export type DepositStatus = "PENDING" | "APPROVED" | "REJECTED";

export interface DepositNetworkOption {
  network: DepositNetworkCode;
  currency: "USDT";
  label: string;
}

/** The logged-in user's unique receiving address for a given network. */
export interface DepositAddressOption {
  network: DepositNetworkCode;
  currency: "USDT";
  label: string;
  address: string;
  qrPayload: string;
}

export interface DepositRequestRecord {
  id: string;
  user_id: string;
  amount: string;
  currency: string;
  network: DepositNetworkCode;
  tx_hash: string | null;
  proof_image: string | null;
  status: DepositStatus;
  reviewed_by_admin_id: string | null;
  deposit_address_id: string | null;
  deposit_address?: string | null;
  sweep_tx_hash?: string | null;
  swept_at?: string | null;
  created_at: string;
  updated_at: string;
}

export async function getDepositNetworks() {
  const { data } = await api.get<ApiSuccessResponse<DepositNetworkOption[]>>("/deposit/networks");
  return data;
}

/** Fetches (and lazily provisions, on first call) the user's unique deposit address for `network`. */
export async function getDepositAddress(network: DepositNetworkCode) {
  const { data } = await api.get<ApiSuccessResponse<DepositAddressOption>>("/deposit/address", {
    params: { network },
  });
  return data;
}

export async function getDepositHistory() {
  const { data } = await api.get<ApiSuccessResponse<DepositRequestRecord[]>>("/deposit/history");
  return data;
}

/** Resolves a backend-relative asset path (e.g. `/uploads/...`) to an absolute URL. */
export function resolveAssetUrl(relativePath: string): string {
  const apiBaseUrl = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:4000/api/v1";
  const serverOrigin = apiBaseUrl.replace(/\/api\/v1\/?$/, "");
  return `${serverOrigin}${relativePath}`;
}
