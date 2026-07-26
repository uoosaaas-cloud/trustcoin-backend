import { NextResponse } from "next/server";
import type { MarketAssetId, MarketAssetPayload } from "@/lib/markets";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const CRYPTO_IDS: Record<string, MarketAssetId> = {
  bitcoin: "btc",
  ethereum: "eth",
  binancecoin: "bnb",
  tron: "trx",
};

const CRYPTO_META: Record<
  MarketAssetId,
  { symbol: string; name: string; pair: string }
> = {
  btc: { symbol: "BTC", name: "Bitcoin", pair: "BTC/USD" },
  eth: { symbol: "ETH", name: "Ethereum", pair: "ETH/USD" },
  bnb: { symbol: "BNB", name: "Binance Coin", pair: "BNB/USD" },
  trx: { symbol: "TRX", name: "TRON", pair: "TRX/USD" },
  xau: { symbol: "XAU", name: "Gold", pair: "XAU/USD" },
  wti: { symbol: "WTI", name: "Crude Oil", pair: "WTI/USD" },
};

/** Deterministic fallback sparkline so the UI never collapses if an upstream fails. */
function fallbackSparkline(base: number, changePct: number, points = 32): number[] {
  const series: number[] = [];
  let value = base / (1 + changePct / 100);
  for (let i = 0; i < points; i += 1) {
    const wave = Math.sin(i / 4.2) * 0.004 + Math.cos(i / 7.1) * 0.0025;
    const drift = (changePct / 100) * (i / (points - 1));
    value = base * (1 + drift + wave);
    series.push(Number(value.toFixed(6)));
  }
  series[series.length - 1] = base;
  return series;
}

async function fetchCryptoAssets(): Promise<MarketAssetPayload[]> {
  const url =
    "https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd&ids=bitcoin,ethereum,binancecoin,tron&order=market_cap_desc&sparkline=true&price_change_percentage=24h";

  const response = await fetch(url, {
    headers: { Accept: "application/json" },
    next: { revalidate: 30 },
  });

  if (!response.ok) {
    throw new Error(`CoinGecko ${response.status}`);
  }

  const rows = (await response.json()) as Array<{
    id: string;
    current_price: number;
    price_change_percentage_24h: number | null;
    sparkline_in_7d?: { price?: number[] };
  }>;

  return rows
    .map((row) => {
      const id = CRYPTO_IDS[row.id];
      if (!id) return null;
      const meta = CRYPTO_META[id];
      const price = Number(row.current_price);
      const change24h = Number(row.price_change_percentage_24h ?? 0);
      const sparkRaw = row.sparkline_in_7d?.price ?? [];
      // Keep last ~36 points for a clean 24h-feel mini chart
      const sparkline =
        sparkRaw.length > 8
          ? sparkRaw.slice(-36).map((n) => Number(n))
          : fallbackSparkline(price, change24h);

      return {
        id,
        symbol: meta.symbol,
        name: meta.name,
        pair: meta.pair,
        price,
        change24h,
        sparkline,
        updatedAt: new Date().toISOString(),
      } satisfies MarketAssetPayload;
    })
    .filter((item): item is MarketAssetPayload => item !== null);
}

async function fetchYahooAsset(
  yahooSymbol: string,
  id: "xau" | "wti"
): Promise<MarketAssetPayload> {
  const meta = CRYPTO_META[id];
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(
    yahooSymbol
  )}?interval=15m&range=1d`;

  const response = await fetch(url, {
    headers: {
      Accept: "application/json",
      "User-Agent": "TrustCoin/1.0",
    },
    next: { revalidate: 30 },
  });

  if (!response.ok) {
    throw new Error(`Yahoo ${yahooSymbol} ${response.status}`);
  }

  const json = (await response.json()) as {
    chart?: {
      result?: Array<{
        meta?: { regularMarketPrice?: number; previousClose?: number; chartPreviousClose?: number };
        indicators?: { quote?: Array<{ close?: Array<number | null> }> };
      }>;
    };
  };

  const result = json.chart?.result?.[0];
  if (!result) {
    throw new Error(`Yahoo ${yahooSymbol} empty`);
  }

  const closes = (result.indicators?.quote?.[0]?.close ?? []).filter(
    (n): n is number => typeof n === "number" && Number.isFinite(n)
  );

  const price =
    Number(result.meta?.regularMarketPrice) ||
    closes[closes.length - 1] ||
    0;
  const previous =
    Number(result.meta?.previousClose ?? result.meta?.chartPreviousClose) ||
    closes[0] ||
    price;
  const change24h = previous > 0 ? ((price - previous) / previous) * 100 : 0;
  const sparkline =
    closes.length > 4 ? closes.slice(-36) : fallbackSparkline(price, change24h);

  return {
    id,
    symbol: meta.symbol,
    name: meta.name,
    pair: meta.pair,
    price,
    change24h,
    sparkline,
    updatedAt: new Date().toISOString(),
  };
}

function fallbackAsset(id: MarketAssetId, price: number, change24h: number): MarketAssetPayload {
  const meta = CRYPTO_META[id];
  return {
    id,
    symbol: meta.symbol,
    name: meta.name,
    pair: meta.pair,
    price,
    change24h,
    sparkline: fallbackSparkline(price, change24h),
    updatedAt: new Date().toISOString(),
  };
}

export async function GET() {
  const [cryptoResult, goldResult, oilResult] = await Promise.allSettled([
    fetchCryptoAssets(),
    fetchYahooAsset("GC=F", "xau"),
    fetchYahooAsset("CL=F", "wti"),
  ]);

  const crypto =
    cryptoResult.status === "fulfilled"
      ? cryptoResult.value
      : [
          fallbackAsset("btc", 97500, 1.24),
          fallbackAsset("eth", 3450, -0.82),
          fallbackAsset("bnb", 645, 0.55),
          fallbackAsset("trx", 0.248, 2.1),
        ];

  const gold =
    goldResult.status === "fulfilled"
      ? goldResult.value
      : fallbackAsset("xau", 2685, 0.35);

  const oil =
    oilResult.status === "fulfilled"
      ? oilResult.value
      : fallbackAsset("wti", 72.4, -0.48);

  const byId = new Map<MarketAssetId, MarketAssetPayload>();
  for (const item of crypto) byId.set(item.id, item);
  byId.set("xau", gold);
  byId.set("wti", oil);

  const order: MarketAssetId[] = ["btc", "eth", "bnb", "trx", "xau", "wti"];
  const assets = order.map(
    (id) =>
      byId.get(id) ??
      fallbackAsset(
        id,
        id === "btc" ? 97000 : id === "eth" ? 3400 : id === "bnb" ? 640 : id === "trx" ? 0.24 : id === "xau" ? 2680 : 72,
        0
      )
  );

  return NextResponse.json({
    success: true,
    data: {
      assets,
      refreshedAt: new Date().toISOString(),
    },
  });
}
