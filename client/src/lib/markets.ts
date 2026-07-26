export type MarketAssetId = "btc" | "eth" | "bnb" | "trx" | "xau" | "wti";

export interface MarketAssetPayload {
  id: MarketAssetId;
  symbol: string;
  name: string;
  pair: string;
  price: number;
  change24h: number;
  sparkline: number[];
  updatedAt: string;
}

export interface MarketsApiResponse {
  success: boolean;
  data: {
    assets: MarketAssetPayload[];
    refreshedAt: string;
  };
}
