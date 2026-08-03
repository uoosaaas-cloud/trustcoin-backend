import { ApiError } from "../utils/apiError";

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

const CRYPTO_IDS: Record<string, MarketAssetId> = {
  bitcoin: "btc",
  ethereum: "eth",
  binancecoin: "bnb",
  tron: "trx",
  "pax-gold": "xau",
};

const ASSET_META: Record<
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

const DISPLAY_ORDER: MarketAssetId[] = ["btc", "eth", "bnb", "trx", "xau", "wti"];

const CACHE_TTL_MS = 30_000;
const FETCH_TIMEOUT_MS = 12_000;

let cache: { payload: MarketsOverviewPayload; expiresAt: number } | null = null;

export interface MarketsOverviewPayload {
  assets: MarketAssetPayload[];
  refreshedAt: string;
}

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

async function fetchJson<T>(url: string, init?: RequestInit): Promise<T> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

  try {
    const response = await fetch(url, {
      ...init,
      signal: controller.signal,
      headers: {
        Accept: "application/json",
        "User-Agent": "TrustCoin-Markets/1.0",
        ...(init?.headers ?? {}),
      },
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status} for ${url}`);
    }

    return (await response.json()) as T;
  } finally {
    clearTimeout(timer);
  }
}

async function fetchCryptoAssets(): Promise<MarketAssetPayload[]> {
  const url =
    "https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd&ids=bitcoin,ethereum,binancecoin,tron,pax-gold&order=market_cap_desc&sparkline=true&price_change_percentage=24h";

  const rows = await fetchJson<
    Array<{
      id: string;
      current_price: number;
      price_change_percentage_24h: number | null;
      sparkline_in_7d?: { price?: number[] };
    }>
  >(url);

  const assets = rows
    .map((row) => {
      const id = CRYPTO_IDS[row.id];
      if (!id) return null;

      const meta = ASSET_META[id];
      const price = Number(row.current_price);
      const change24h = Number(row.price_change_percentage_24h ?? 0);
      const sparkRaw = row.sparkline_in_7d?.price ?? [];
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

  const requiredCrypto: MarketAssetId[] = ["btc", "eth", "bnb", "trx"];
  for (const id of requiredCrypto) {
    if (!assets.some((item) => item.id === id)) {
      throw new Error(`Missing crypto market asset: ${id}`);
    }
  }

  return assets;
}

async function fetchYahooAssetWithRetry(
  yahooSymbol: string,
  id: "xau" | "wti",
  attempts = 3
): Promise<MarketAssetPayload> {
  let lastError: unknown;
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    try {
      if (attempt > 0) {
        await new Promise((resolve) => setTimeout(resolve, 800 * attempt));
      }
      return await fetchYahooAsset(yahooSymbol, id);
    } catch (error) {
      lastError = error;
    }
  }
  throw lastError instanceof Error ? lastError : new Error(String(lastError));
}

async function fetchOilAsset(): Promise<MarketAssetPayload | null> {
  await new Promise((resolve) => setTimeout(resolve, 1500));

  try {
    return await fetchYahooAssetWithRetry("CL=F", "wti");
  } catch {
    try {
      await new Promise((resolve) => setTimeout(resolve, 1200));
      const uso = await fetchYahooAssetWithRetry("USO", "wti");
      return { ...uso, name: "Crude Oil", pair: "WTI/USD" };
    } catch {
      return null;
    }
  }
}

async function fetchYahooAsset(
  yahooSymbol: string,
  id: "xau" | "wti"
): Promise<MarketAssetPayload> {
  const meta = ASSET_META[id];
  const url = `https://query2.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(
    yahooSymbol
  )}?interval=15m&range=1d`;

  const json = await fetchJson<{
    chart?: {
      result?: Array<{
        meta?: {
          regularMarketPrice?: number;
          previousClose?: number;
          chartPreviousClose?: number;
        };
        indicators?: { quote?: Array<{ close?: Array<number | null> }> };
      }>;
    };
  }>(url, {
    headers: {
      "User-Agent":
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    },
  });

  const result = json.chart?.result?.[0];
  if (!result) throw new Error(`Yahoo ${yahooSymbol} empty`);

  const closes = (result.indicators?.quote?.[0]?.close ?? []).filter(
    (n): n is number => typeof n === "number" && Number.isFinite(n)
  );

  const price =
    Number(result.meta?.regularMarketPrice) || closes[closes.length - 1] || 0;
  const previous =
    Number(result.meta?.previousClose ?? result.meta?.chartPreviousClose) ||
    closes[0] ||
    price;
  const change24h = previous > 0 ? ((price - previous) / previous) * 100 : 0;
  const sparkline =
    closes.length > 4 ? closes.slice(-36) : fallbackSparkline(price, change24h);

  if (!Number.isFinite(price) || price <= 0) {
    throw new Error(`Yahoo ${yahooSymbol} invalid price`);
  }

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

export async function getMarketsOverview(): Promise<MarketsOverviewPayload> {
  const now = Date.now();
  if (cache && cache.expiresAt > now) {
    return cache.payload;
  }

  let cryptoResult: PromiseSettledResult<MarketAssetPayload[]>;

  try {
    cryptoResult = { status: "fulfilled", value: await fetchCryptoAssets() };
  } catch (reason) {
    cryptoResult = { status: "rejected", reason };
  }

  const oilAsset = await fetchOilAsset();

  const byId = new Map<MarketAssetId, MarketAssetPayload>();

  if (cryptoResult.status === "fulfilled") {
    for (const item of cryptoResult.value) byId.set(item.id, item);
  }

  if (oilAsset) {
    byId.set("wti", oilAsset);
  }

  if (byId.size === 0) {
    throw ApiError.serviceUnavailable("markets.feed_unavailable");
  }

  const assets = DISPLAY_ORDER.map((id) => byId.get(id)).filter(
    (item): item is MarketAssetPayload => item !== undefined
  );

  const payload: MarketsOverviewPayload = {
    assets,
    refreshedAt: new Date().toISOString(),
  };

  // Cache complete boards; cache crypto+gold boards for a shorter TTL when oil is unavailable.
  if (assets.length === DISPLAY_ORDER.length) {
    cache = { payload, expiresAt: now + CACHE_TTL_MS };
  } else if (assets.length >= 5) {
    cache = { payload, expiresAt: now + 10_000 };
  }

  return payload;
}
