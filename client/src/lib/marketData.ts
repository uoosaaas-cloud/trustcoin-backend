import { api, type ApiSuccessResponse } from "./api";
import type { MarketAssetPayload, MarketsApiResponse } from "./markets";

/** Fetches live market cards from the TrustCoin API (server-proxied feeds). */
export async function fetchMarketAssets(): Promise<{
  assets: MarketAssetPayload[];
  refreshedAt: string;
}> {
  const { data } = await api.get<ApiSuccessResponse<MarketsApiResponse["data"]>>("/markets/overview");
  return data.data;
}
