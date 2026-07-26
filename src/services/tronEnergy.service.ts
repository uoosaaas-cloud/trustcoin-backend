import { env } from "../config/env";
import { safeErrorMessage } from "../utils/chain/common";

/**
 * Energy for TRC-20 USDT `transfer` when the destination already holds USDT
 * (~65k). First-ever receive on an empty address needs ~131k — see
 * `ENERGY_USDT_TRANSFER_FIRST_RECEIVE`.
 */
export const DEFAULT_TRON_USDT_TRANSFER_ENERGY = 65_000;

/** Energy when master/destination has never held USDT (new account path + margin). */
/** First USDT receive into an empty wallet needs more energy (~131k+) — keep a buffer. */
export const ENERGY_USDT_TRANSFER_FIRST_RECEIVE = 160_000;

/** Rough Feee TRX cost estimate — used to fail fast before placing an order. */
export function estimateFeeeOrderTrx(energyAmount: number): number {
  if (energyAmount >= 131_000) return 8;
  if (energyAmount >= 65_000) return 5;
  if (energyAmount >= 32_000) return 3;
  return 2;
}

/** Official Feee client UA — required when User-Agent whitelist is enabled. */
export const FEEE_USER_AGENT = "Feee.io Client/1.0.0 (https://feee.io)";

export interface RentTronEnergyResult {
  /** True when energy was ordered / confirmed via the rental API. */
  rented: boolean;
  /** True when the caller should proceed with a normal TronWeb transfer (burn TRX if needed). */
  usedFallback: boolean;
  orderNo?: string;
  frozenTxId?: string;
  energyAmount: number;
  reason?: string;
  /** Feee API business code when submit/query failed (e.g. 20012). */
  feeeCode?: number;
}

interface FeeeOrderDetail {
  order_no?: string;
  frozen_tx_id?: string;
  frozen_resource_value?: number;
  resource_value?: number;
  status?: number;
  business_status?: number;
  pay_amount?: number;
}

interface FeeeApiResponse<T> {
  code: number;
  msg: string;
  request_id?: string;
  data?: T;
}

function energyApiConfigured(): boolean {
  return Boolean(env.TRON_ENERGY_API_KEY && env.TRON_ENERGY_PROVIDER_URL);
}

function buildHeaders(): Record<string, string> {
  return {
    key: env.TRON_ENERGY_API_KEY,
    "Content-Type": "application/json",
    "User-Agent": FEEE_USER_AGENT,
  };
}

function providerBaseUrl(): string {
  return env.TRON_ENERGY_PROVIDER_URL.replace(/\/+$/, "");
}

function submitPath(): string {
  const base = providerBaseUrl();
  return base.endsWith("/v2") ? `${base}/order/submit` : `${base}/v2/order/submit`;
}

function queryPath(orderNo: string): string {
  const base = providerBaseUrl();
  const root = base.endsWith("/v2") ? base : `${base}/v2`;
  return `${root}/order/query?order_no=${encodeURIComponent(orderNo)}`;
}

function apiQueryPath(): string {
  const base = providerBaseUrl();
  const root = base.endsWith("/v2") ? base : `${base}/v2`;
  return `${root}/api/query`;
}

async function fetchJson<T>(url: string, init: RequestInit): Promise<FeeeApiResponse<T>> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), env.TRON_ENERGY_TIMEOUT_MS);

  try {
    const response = await fetch(url, { ...init, signal: controller.signal });
    const text = await response.text();
    let parsed: FeeeApiResponse<T>;
    try {
      parsed = JSON.parse(text) as FeeeApiResponse<T>;
    } catch {
      throw new Error(`Energy API returned non-JSON (HTTP ${response.status}): ${text.slice(0, 200)}`);
    }

    if (!response.ok) {
      throw new Error(`Energy API HTTP ${response.status}: ${parsed.msg || text.slice(0, 200)}`);
    }

    return parsed;
  } finally {
    clearTimeout(timeout);
  }
}

function isDelegationReady(order: FeeeOrderDetail | undefined, requiredEnergy: number): boolean {
  if (!order) return false;
  // Require on-chain delegation evidence — status alone can be "paid" before resources arrive,
  // which caused premature success → failed transfer → duplicate Feee orders.
  if (order.frozen_tx_id && order.frozen_tx_id.length > 0) return true;
  if (typeof order.frozen_resource_value === "number" && order.frozen_resource_value >= requiredEnergy) {
    return true;
  }
  return false;
}

function isWhitelistError(code: number): boolean {
  return code === 20012 || code === 20013;
}

function formatFeeeSubmitError(code: number, msg: string): string {
  if (code === 20002) {
    return (
      `Feee.io balance too low (code=20002): ${msg}. ` +
      `Top up TRX in your Feee account (User Center → Balance), then retry. ` +
      `A first USDT receive to an empty master wallet needs ~131k Energy (~5–8 TRX).`
    );
  }
  if (isWhitelistError(code)) {
    return (
      `Feee.io energy rental blocked (code=${code}): ${msg}. ` +
      `Add this server's public IP to the API key whitelist in Feee User Center, ` +
      `or clear the IP whitelist and allow User-Agent "${FEEE_USER_AGENT}".`
    );
  }
  return `Feee.io energy rental failed (code=${code}): ${msg}`;
}

async function waitForDelegation(
  orderNo: string,
  requiredEnergy: number
): Promise<{ ready: boolean; order?: FeeeOrderDetail }> {
  const attempts = Math.max(1, env.TRON_ENERGY_CONFIRM_ATTEMPTS);
  const delayMs = Math.max(250, env.TRON_ENERGY_CONFIRM_DELAY_MS);

  for (let i = 0; i < attempts; i++) {
    const result = await fetchJson<FeeeOrderDetail>(queryPath(orderNo), {
      method: "GET",
      headers: buildHeaders(),
    });

    if (result.code === 0 && isDelegationReady(result.data, requiredEnergy)) {
      return { ready: true, order: result.data };
    }

    if (i < attempts - 1) {
      await new Promise((resolve) => setTimeout(resolve, delayMs));
    }
  }

  try {
    const last = await fetchJson<FeeeOrderDetail>(queryPath(orderNo), {
      method: "GET",
      headers: buildHeaders(),
    });
    return { ready: isDelegationReady(last.data, requiredEnergy), order: last.data };
  } catch {
    return { ready: false };
  }
}

/** Probe Feee API key (balance / whitelist error) without placing an order. */
export async function probeFeeeApiKey(): Promise<{
  ok: boolean;
  code: number;
  msg: string;
  trxBalance?: number;
  whitelist?: string;
  raw?: unknown;
}> {
  if (!energyApiConfigured()) {
    return { ok: false, code: -1, msg: "TRON_ENERGY_API_KEY / TRON_ENERGY_PROVIDER_URL not configured" };
  }

  const result = await fetchJson<Record<string, unknown>>(apiQueryPath(), {
    method: "GET",
    headers: buildHeaders(),
  });

  if (result.code !== 0 || !result.data) {
    return { ok: false, code: result.code, msg: result.msg, raw: result };
  }

  return {
    ok: true,
    code: 0,
    msg: result.msg,
    trxBalance: typeof result.data.trx_money === "number" ? result.data.trx_money : undefined,
    whitelist: typeof result.data.whitelist === "string" ? result.data.whitelist : undefined,
    raw: result.data,
  };
}

/**
 * Rents Tron ENERGY only for `targetAddress` via Feee.io Fast-Trade
 * (POST /v2/order/submit + GET /v2/order/query, resource_type: 1).
 *
 * Never request Bandwidth from Feee Fast-Trade — it may fulfill as Energy and
 * double-charge the Feee balance. Bandwidth uses free Net / TRX burn instead.
 */
export async function rentTronEnergy(
  targetAddress: string,
  requiredEnergy: number = DEFAULT_TRON_USDT_TRANSFER_ENERGY
): Promise<RentTronEnergyResult> {
  const energyAmount = Math.max(32_000, Math.ceil(requiredEnergy));
  const requireFeee = energyApiConfigured() && env.TRON_ENERGY_REQUIRE;

  if (!energyApiConfigured()) {
    return {
      rented: false,
      usedFallback: true,
      energyAmount,
      reason: "TRON_ENERGY_API_KEY / TRON_ENERGY_PROVIDER_URL not configured",
    };
  }

  const probe = await probeFeeeApiKey();
  const estimatedTrx = estimateFeeeOrderTrx(energyAmount);
  if (probe.ok && typeof probe.trxBalance === "number" && probe.trxBalance < estimatedTrx) {
    // eslint-disable-next-line no-console
    console.warn(
      `[tron-energy] Feee balance ${probe.trxBalance} TRX < ~${estimatedTrx} TRX needed for ${energyAmount} energy — skipping order.`
    );
    return {
      rented: false,
      usedFallback: true,
      energyAmount,
      feeeCode: 20002,
      reason: `Feee balance ${probe.trxBalance} TRX is below ~${estimatedTrx} TRX needed for ${energyAmount} energy`,
    };
  }

  try {
    // Docs-exact payload (rent_time_second=600 takes precedence over duration/unit).
    const submit = await fetchJson<FeeeOrderDetail>(submitPath(), {
      method: "POST",
      headers: buildHeaders(),
      body: JSON.stringify({
        resource_type: 1, // ENERGY only — never 0 (Bandwidth) on Fast-Trade
        receive_address: targetAddress,
        resource_value: energyAmount,
        rent_duration: 1,
        rent_time_unit: "h",
        rent_time_second: 600,
      }),
    });

    if (submit.code !== 0 || !submit.data?.order_no) {
      // eslint-disable-next-line no-console
      console.warn(
        `[tron-energy] Rent submit failed for ${targetAddress}: code=${submit.code} msg=${submit.msg}`
      );

      if (requireFeee || isWhitelistError(submit.code)) {
        throw new Error(formatFeeeSubmitError(submit.code, submit.msg));
      }

      return {
        rented: false,
        usedFallback: true,
        energyAmount,
        feeeCode: submit.code,
        reason: submit.msg || `Energy API code ${submit.code}`,
      };
    }

    const orderNo = submit.data.order_no;

    if (isDelegationReady(submit.data, energyAmount)) {
      // eslint-disable-next-line no-console
      console.info(
        `[tron-energy] Rented for ${targetAddress}: order=${orderNo} pay_amount=${submit.data.pay_amount ?? "?"} TRX`
      );
      return {
        rented: true,
        usedFallback: false,
        orderNo,
        frozenTxId: submit.data.frozen_tx_id || undefined,
        energyAmount,
      };
    }

    const confirmation = await waitForDelegation(orderNo, energyAmount);
    if (confirmation.ready) {
      // eslint-disable-next-line no-console
      console.info(
        `[tron-energy] Delegation confirmed for ${targetAddress}: order=${orderNo} amount=${energyAmount}`
      );
      return {
        rented: true,
        usedFallback: false,
        orderNo,
        frozenTxId: confirmation.order?.frozen_tx_id || undefined,
        energyAmount,
      };
    }

    // eslint-disable-next-line no-console
    console.warn(
      `[tron-energy] Delegation not confirmed in time for ${targetAddress} (order ${orderNo}).`
    );

    if (requireFeee) {
      throw new Error(
        `Feee.io order ${orderNo} was created but energy delegation was not confirmed in time. ` +
          `Check the order in Feee dashboard before retrying.`
      );
    }

    return {
      rented: false,
      usedFallback: true,
      orderNo,
      energyAmount,
      reason: "Energy delegation confirmation timed out",
    };
  } catch (error) {
    if (error instanceof Error && error.message.startsWith("Feee.io")) {
      throw error;
    }

    // eslint-disable-next-line no-console
    console.warn(
      `[tron-energy] Rent failed for ${targetAddress}: ${safeErrorMessage(error)}`
    );

    if (requireFeee) {
      throw new Error(`Feee.io energy rental failed: ${safeErrorMessage(error)}`);
    }

    return {
      rented: false,
      usedFallback: true,
      energyAmount,
      reason: safeErrorMessage(error),
    };
  }
}
