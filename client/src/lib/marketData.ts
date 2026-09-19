import { api, type ApiSuccessResponse } from "./api";
import type { MarketAssetId, MarketAssetPayload } from "./markets";

export type { MarketAssetId, MarketAssetPayload };

/** Fetches the cached market board from the TrustCoin API. */
export async function fetchMarketAssets(): Promise<{
  assets: MarketAssetPayload[];
  refreshedAt: string;
}> {
  const { data } = await api.get<
    ApiSuccessResponse<{ assets: MarketAssetPayload[]; refreshedAt: string }>
  >("/markets/overview");

  return {
    assets: data.data?.assets ?? [],
    refreshedAt: data.data?.refreshedAt ?? new Date().toISOString(),
  };
}
