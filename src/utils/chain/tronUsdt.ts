import { TronWeb } from "tronweb";
import { env } from "../../config/env";
import {
  DEFAULT_TRON_USDT_TRANSFER_ENERGY,
  ENERGY_USDT_TRANSFER_FIRST_RECEIVE,
  estimateFeeeOrderTrx,
  probeFeeeApiKey,
  rentTronEnergy,
} from "../../services/tronEnergy.service";
import { assertValidMasterWallet } from "../walletAddress";
import { resolveTronBandwidthFunder } from "../tronFunderKey";
import { safeErrorMessage } from "./common";

export interface TronUsdtBalance {
  raw: bigint;
  human: string;
  decimals: number;
}

export interface TronSweepResult {
  sweepTxHash: string;
  /** Feee order / frozen tx id (stored in `gas_topup_tx_hash`). */
  energyRentalRef?: string;
  bandwidthReclaimTxHash?: string;
  amountHuman: string;
  amountRaw: bigint;
}

const TRC20_USDT_DECIMALS = 6;
const SUN_PER_TRX = 1_000_000;
/** Free/staked Bandwidth typically needed to broadcast a TRC-20 transfer. */
const MIN_TRC20_BANDWIDTH = 350;
/**
 * Tron caps contract energy by feeLimit / energyPrice — even when the account
 * already has delegated Feee energy. A low feeLimit (e.g. 3 TRX → ~30k energy
 * cap) causes OUT_OF_ENERGY despite EnergyLimit >> need. Use 100 TRX headroom;
 * TRX is only burned if energy is actually missing.
 */
const FEE_LIMIT_WITH_ENERGY_SUN = 100_000_000;
/** Same headroom when a small energy gap remains after Feee delegation. */
const FEE_LIMIT_ENERGY_GAP_SUN = 100_000_000;

function tronHostsInPriorityOrder(): string[] {
  const hosts = [env.TRON_FULL_HOST, env.TRON_FALLBACK_HOST]
    .map((host) => host.trim())
    .filter((host) => host.length > 0);
  return [...new Set(hosts)];
}

function shouldAttachTronApiKey(fullHost: string): boolean {
  return /trongrid\.io/i.test(fullHost) && Boolean(env.TRON_API_KEY);
}

function isRetryableTronError(error: unknown): boolean {
  const message = safeErrorMessage(error).toLowerCase();
  return (
    message.includes("429") ||
    message.includes("too many requests") ||
    message.includes("econnreset") ||
    message.includes("etimedout") ||
    message.includes("enotfound") ||
    message.includes("network") ||
    message.includes("socket hang up")
  );
}

function normalizePrivateKey(privateKeyHex: string): string {
  return privateKeyHex.startsWith("0x") ? privateKeyHex.slice(2) : privateKeyHex;
}

function createTronWeb(privateKeyHex?: string, fullHost: string = env.TRON_FULL_HOST): TronWeb {
  const headers: Record<string, string> = {};
  if (shouldAttachTronApiKey(fullHost)) {
    headers["TRON-PRO-API-KEY"] = env.TRON_API_KEY;
  }

  const normalizedKey = privateKeyHex ? normalizePrivateKey(privateKeyHex) : undefined;
  const tronWeb = new TronWeb({
    fullHost,
    headers,
    privateKey: normalizedKey,
  });

  if (
    headers["TRON-PRO-API-KEY"] &&
    typeof (tronWeb as { setHeader?: (h: Record<string, string>) => void }).setHeader === "function"
  ) {
    (tronWeb as { setHeader: (h: Record<string, string>) => void }).setHeader({
      "TRON-PRO-API-KEY": headers["TRON-PRO-API-KEY"],
    });
  }

  return tronWeb;
}

async function withTronHostFallback<T>(
  fn: (tronWeb: TronWeb, fullHost: string) => Promise<T>,
  privateKeyHex?: string
): Promise<T> {
  const hosts = tronHostsInPriorityOrder();
  let lastError: unknown;

  for (let index = 0; index < hosts.length; index++) {
    const host = hosts[index];
    try {
      return await fn(createTronWeb(privateKeyHex, host), host);
    } catch (error) {
      lastError = error;
      if (index >= hosts.length - 1 || !isRetryableTronError(error)) throw error;
      // eslint-disable-next-line no-console
      console.warn(
        `[tron] Host ${host} failed (${safeErrorMessage(error)}); retrying on ${hosts[index + 1]}...`
      );
    }
  }

  throw lastError instanceof Error ? lastError : new Error(safeErrorMessage(lastError));
}

function toHumanUsdt(raw: bigint): string {
  const neg = raw < 0n;
  const abs = neg ? -raw : raw;
  const whole = abs / 10n ** BigInt(TRC20_USDT_DECIMALS);
  const frac = abs % 10n ** BigInt(TRC20_USDT_DECIMALS);
  const fracStr = frac.toString().padStart(TRC20_USDT_DECIMALS, "0").replace(/0+$/, "");
  const value = fracStr.length > 0 ? `${whole.toString()}.${fracStr}` : whole.toString();
  return neg ? `-${value}` : value;
}

function humanUsdtToRawApprox(human: string): bigint {
  const [wholePart, fracPart = ""] = human.trim().split(".");
  const whole = BigInt(wholePart || "0");
  const frac = (fracPart + "000000").slice(0, TRC20_USDT_DECIMALS);
  return whole * 10n ** BigInt(TRC20_USDT_DECIMALS) + BigInt(frac || "0");
}

export async function getTronUsdtBalance(address: string): Promise<TronUsdtBalance> {
  return withTronHostFallback(async (tronWeb) => {
    tronWeb.setAddress(address);
    const contract = await tronWeb.contract().at(env.USDT_CONTRACT_TRC20);
    const rawValue = await contract.balanceOf(address).call();
    const raw = BigInt(rawValue.toString());
    return { raw, human: toHumanUsdt(raw), decimals: TRC20_USDT_DECIMALS };
  });
}

function funderFromEnv(): { key: string; address: string } | null {
  const resolved = resolveTronBandwidthFunder();
  if (!resolved) return null;
  return { key: resolved.privateKeyHex, address: resolved.address };
}

async function readAccountResources(address: string): Promise<{
  energyLeft: number;
  bandwidthLeft: number;
}> {
  return withTronHostFallback(async (tronWeb) => {
    tronWeb.setAddress(address);
    const res = await tronWeb.trx.getAccountResources(address);
    const energyLimit = Number(res.EnergyLimit ?? 0);
    const energyUsed = Number(res.EnergyUsed ?? 0);
    const freeNetLimit = Number(res.freeNetLimit ?? 0);
    const freeNetUsed = Number(res.freeNetUsed ?? 0);
    const netLimit = Number(res.NetLimit ?? 0);
    const netUsed = Number(res.NetUsed ?? 0);
    return {
      energyLeft: Math.max(0, energyLimit - energyUsed),
      bandwidthLeft: Math.max(0, freeNetLimit - freeNetUsed) + Math.max(0, netLimit - netUsed),
    };
  });
}

async function getTrxBalanceSun(address: string): Promise<number> {
  return withTronHostFallback(async (tronWeb) => {
    tronWeb.setAddress(address);
    return Number((await tronWeb.trx.getBalance(address)) ?? 0);
  });
}

async function broadcastTrxTransfer(
  fromPrivateKeyHex: string,
  toAddress: string,
  amountSun: number
): Promise<string> {
  return withTronHostFallback(async (signer) => {
    const result = await signer.trx.sendTransaction(toAddress, amountSun);
    const txid =
      result && typeof result === "object" ? String((result as { txid?: string }).txid ?? "") : "";
    const ok =
      Boolean(txid) ||
      (result && typeof result === "object" && (result as { result?: boolean }).result === true);
    if (!ok) {
      throw new Error(`TRX transfer failed: ${safeErrorMessage(JSON.stringify(result))}`);
    }
    return txid || "broadcast-ok";
  }, fromPrivateKeyHex);
}

async function waitForTrxTopupConfirmed(
  toAddress: string,
  txid: string,
  minTrxSun: number,
  balanceBeforeSun: number
): Promise<void> {
  if (!txid || txid === "broadcast-ok") {
    await new Promise((resolve) => setTimeout(resolve, 3000));
  } else {
    let confirmed = false;
    for (let i = 0; i < 40; i++) {
      try {
        const info = await withTronHostFallback(async (tw) => tw.trx.getTransactionInfo(txid));
        if (info && (info as { blockNumber?: number }).blockNumber) {
          const receipt = (info as { receipt?: { result?: string } }).receipt;
          const result = receipt?.result ?? (info as { result?: string }).result;
          if (result && result !== "SUCCESS") {
            throw new Error(`TRX top-up tx=${txid} failed on-chain (${result}).`);
          }
          confirmed = true;
          break;
        }
      } catch (error) {
        if (error instanceof Error && error.message.includes("failed on-chain")) throw error;
      }
      await new Promise((resolve) => setTimeout(resolve, 1500));
    }
    if (!confirmed) {
      throw new Error(`TRX top-up tx=${txid} not confirmed within timeout.`);
    }
  }

  for (let i = 0; i < 20; i++) {
    const trxSun = await getTrxBalanceSun(toAddress);
    if (trxSun >= minTrxSun || trxSun > balanceBeforeSun + 50_000) {
      // eslint-disable-next-line no-console
      console.info(
        `[tron] ${toAddress} funded with ${(trxSun / SUN_PER_TRX).toFixed(3)} TRX ` +
          `(target ≥ ${(minTrxSun / SUN_PER_TRX).toFixed(3)}).`
      );
      return;
    }
    await new Promise((resolve) => setTimeout(resolve, 2000));
  }

  const trxSun = await getTrxBalanceSun(toAddress);
  throw new Error(
    `TRX top-up tx=${txid} confirmed but ${toAddress} balance is still ` +
      `${(trxSun / SUN_PER_TRX).toFixed(3)} TRX (need ≥ ${(minTrxSun / SUN_PER_TRX).toFixed(3)}).`
  );
}

async function ensureSubWalletTrx(fromAddress: string, minTrx: number, label: string): Promise<void> {
  const minTrxSun = Math.ceil(minTrx * SUN_PER_TRX);
  const trxSun = await getTrxBalanceSun(fromAddress);
  if (trxSun >= minTrxSun) return;

  const funder = funderFromEnv();
  if (!funder) {
    throw new Error(
      `${label}: ${fromAddress} has ${(trxSun / SUN_PER_TRX).toFixed(3)} TRX but needs ~${minTrx} TRX.`
    );
  }

  const topupSun = Math.max(minTrxSun - trxSun, 150_000);
  const funderBal = await getTrxBalanceSun(funder.address);
  if (funderBal < topupSun + 100_000) {
    throw new Error(
      `Funder ${funder.address} has ${(funderBal / SUN_PER_TRX).toFixed(3)} TRX — ` +
        `need ~${(topupSun / SUN_PER_TRX).toFixed(1)} TRX for ${label}.`
    );
  }

  // eslint-disable-next-line no-console
  console.info(
    `[tron] ${label}: top-up ${(topupSun / SUN_PER_TRX).toFixed(2)} TRX → ${fromAddress} from ${funder.address}`
  );
  const txid = await broadcastTrxTransfer(funder.key, fromAddress, topupSun);
  await waitForTrxTopupConfirmed(fromAddress, txid, minTrxSun, trxSun);
}

/**
 * Feee = Energy only. Bandwidth = free Net, else burn TRX (never Feee Bandwidth).
 */
async function ensureBandwidthForTransfer(fromAddress: string): Promise<void> {
  const resources = await readAccountResources(fromAddress);
  if (resources.bandwidthLeft >= MIN_TRC20_BANDWIDTH) return;

  const minTrxSun = Math.ceil(env.TRON_BANDWIDTH_MIN_TRX * SUN_PER_TRX);
  const trxSun = await getTrxBalanceSun(fromAddress);
  if (trxSun >= minTrxSun) {
    // eslint-disable-next-line no-console
    console.info(
      `[tron] Bandwidth low (${resources.bandwidthLeft}) but ${fromAddress} has ` +
        `${(trxSun / SUN_PER_TRX).toFixed(3)} TRX — will burn TRX for Bandwidth.`
    );
    return;
  }

  const funder = funderFromEnv();
  if (!funder) {
    throw new Error(
      `Sub-wallet ${fromAddress} needs Bandwidth: free=${resources.bandwidthLeft}, ` +
        `TRX=${(trxSun / SUN_PER_TRX).toFixed(3)}. Configure TRON_BANDWIDTH_FUNDER_MNEMONIC.`
    );
  }
  if (funder.address === fromAddress) {
    throw new Error("Bandwidth funder must not be the deposit sub-wallet.");
  }

  const topupNeededSun = Math.max(0, minTrxSun - trxSun);
  const configuredTopupSun = Math.ceil(Math.max(0.15, env.TRON_BANDWIDTH_TRX_TOPUP) * SUN_PER_TRX);
  const topupSun = Math.min(configuredTopupSun, Math.max(topupNeededSun, 150_000));
  const funderBal = await getTrxBalanceSun(funder.address);
  if (funderBal < topupSun + 100_000) {
    throw new Error(
      `Bandwidth funder ${funder.address} has ${(funderBal / SUN_PER_TRX).toFixed(3)} TRX ` +
        `(need ~${(topupSun / SUN_PER_TRX).toFixed(3)}).`
    );
  }

  // eslint-disable-next-line no-console
  console.info(
    `[tron] Bandwidth top-up ${(topupSun / SUN_PER_TRX).toFixed(3)} TRX → ${fromAddress} from ${funder.address}`
  );
  const topupTxId = await broadcastTrxTransfer(funder.key, fromAddress, topupSun);
  await waitForTrxTopupConfirmed(fromAddress, topupTxId, minTrxSun, trxSun);
}

async function reclaimLeftoverTrxToFunder(
  subPrivateKeyHex: string,
  fromAddress: string
): Promise<string | undefined> {
  const funder = funderFromEnv();
  if (!funder || funder.address === fromAddress) return undefined;

  const reclaimMinSun = Math.ceil(env.TRON_BANDWIDTH_RECLAIM_MIN_TRX * SUN_PER_TRX);
  const feeBufferSun = 100_000;
  const trxSun = await getTrxBalanceSun(fromAddress);
  const sendSun = trxSun - feeBufferSun;
  if (sendSun < reclaimMinSun) return undefined;

  try {
    const txid = await broadcastTrxTransfer(subPrivateKeyHex, funder.address, sendSun);
    // eslint-disable-next-line no-console
    console.info(
      `[tron] Reclaimed ${(sendSun / SUN_PER_TRX).toFixed(3)} TRX from ${fromAddress} → ${funder.address} tx=${txid}`
    );
    return txid;
  } catch (error) {
    // eslint-disable-next-line no-console
    console.warn(`[tron] TRX reclaim skipped for ${fromAddress}: ${safeErrorMessage(error)}`);
    return undefined;
  }
}

async function waitForOnChainEnergy(address: string, required: number, attempts = 24): Promise<number> {
  for (let i = 0; i < attempts; i++) {
    const { energyLeft } = await readAccountResources(address);
    // eslint-disable-next-line no-console
    if (i === 0 || i % 4 === 0) {
      console.info(`[tron] Waiting for energy on ${address}: have=${energyLeft} need=${required}`);
    }
    if (energyLeft >= required) {
      // Extra settle delay so Feee delegation is fully usable for contract calls.
      await new Promise((resolve) => setTimeout(resolve, 3000));
      return (await readAccountResources(address)).energyLeft;
    }
    await new Promise((resolve) => setTimeout(resolve, 2000));
  }
  return (await readAccountResources(address)).energyLeft;
}

async function resolveRequiredEnergy(toAddress: string, override?: number): Promise<number> {
  if (typeof override === "number" && override > 0) return Math.ceil(override);
  try {
    const destBalance = await getTronUsdtBalance(toAddress);
    if (destBalance.raw > 0n) return DEFAULT_TRON_USDT_TRANSFER_ENERGY;
  } catch (error) {
    // eslint-disable-next-line no-console
    console.warn(
      `[tron] Could not read destination USDT (${safeErrorMessage(error)}); using first-receive energy.`
    );
  }
  return ENERGY_USDT_TRANSFER_FIRST_RECEIVE;
}

/**
 * Prepare Energy for a USDT transfer.
 * Order: reuse on-chain → Feee rent → optional TRX-burn fallback.
 */
async function ensureEnergyForTransfer(
  fromAddress: string,
  requiredEnergy: number
): Promise<{ energyRentalRef?: string; useTrxBurn: boolean }> {
  const resourcesBefore = await readAccountResources(fromAddress);
  if (resourcesBefore.energyLeft >= requiredEnergy) {
    // eslint-disable-next-line no-console
    console.info(
      `[tron] Reusing on-chain energy for ${fromAddress}: ` +
        `available=${resourcesBefore.energyLeft} need=${requiredEnergy}`
    );
    return { useTrxBurn: false };
  }

  // Rent with a buffer — first-receive to an empty master wallet needs ~145k.
  const shortfall = requiredEnergy - resourcesBefore.energyLeft;
  const rentAmount = Math.max(65_000, shortfall + 10_000);

  if (env.TRON_ENERGY_API_KEY) {
    const probe = await probeFeeeApiKey();
    const estimatedTrx = estimateFeeeOrderTrx(rentAmount);
    if (probe.ok && (probe.trxBalance ?? 0) >= estimatedTrx) {
      // eslint-disable-next-line no-console
      console.info(
        `[tron] Energy shortfall for ${fromAddress}: have=${resourcesBefore.energyLeft} ` +
          `need=${requiredEnergy} renting=${rentAmount}`
      );
      const energy = await rentTronEnergy(fromAddress, rentAmount);
      if (energy.rented) {
        const energyRentalRef = energy.frozenTxId || energy.orderNo;
        const available = await waitForOnChainEnergy(fromAddress, requiredEnergy);
        if (available >= requiredEnergy) {
          return { energyRentalRef, useTrxBurn: false };
        }
        // Second top-up if first rent was still short (e.g. partial / delayed).
        const stillShort = requiredEnergy - available;
        if (stillShort > 0 && (probe.trxBalance ?? 0) >= estimateFeeeOrderTrx(Math.max(32_000, stillShort))) {
          const topup = Math.max(32_000, stillShort + 5_000);
          // eslint-disable-next-line no-console
          console.info(`[tron] Energy still short by ${stillShort}; renting top-up ${topup}...`);
          const energy2 = await rentTronEnergy(fromAddress, topup);
          if (energy2.rented) {
            const available2 = await waitForOnChainEnergy(fromAddress, requiredEnergy);
            if (available2 >= requiredEnergy) {
              return {
                energyRentalRef: energy2.frozenTxId || energy2.orderNo || energyRentalRef,
                useTrxBurn: false,
              };
            }
          }
        }
        throw new Error(
          `Feee rented energy but on-chain available=${available} < required=${requiredEnergy} ` +
            `for ${fromAddress}. Wait a few seconds and retry (do not burn TRX for energy).`
        );
      }
    } else {
      // eslint-disable-next-line no-console
      console.warn(
        `[tron] Feee balance ${probe.trxBalance ?? 0} TRX too low for ~${estimatedTrx} TRX order.`
      );
    }
  }

  const after = await readAccountResources(fromAddress);
  if (after.energyLeft >= requiredEnergy) {
    return { useTrxBurn: false };
  }

  if (env.TRON_ENERGY_TRX_BURN_FALLBACK && funderFromEnv()) {
    // eslint-disable-next-line no-console
    console.warn(
      `[tron] TRX-burn Energy fallback on ${fromAddress} ` +
        `(have ${after.energyLeft}, need ${requiredEnergy}).`
    );
    await ensureSubWalletTrx(fromAddress, env.TRON_ENERGY_TRX_BURN_TOPUP, "Energy burn reserve");
    return { useTrxBurn: true };
  }

  throw new Error(
    `Insufficient energy (${after.energyLeft}/${requiredEnergy}) for ${fromAddress}. ` +
      `Fund Feee (≥ ${estimateFeeeOrderTrx(rentAmount)} TRX) or enable TRON_ENERGY_TRX_BURN_FALLBACK.`
  );
}

export async function transferTronUsdt(params: {
  privateKeyHex: string;
  toAddress: string;
  amountRaw: bigint;
  energyAmount?: number;
}): Promise<{ txHash: string; energyRentalRef?: string }> {
  const { privateKeyHex, amountRaw } = params;
  const validatedTo = assertValidMasterWallet("TRC20", params.toAddress);
  const normalizedKey = normalizePrivateKey(privateKeyHex);
  const fromAddress = createTronWeb(normalizedKey).defaultAddress.base58 as string;
  if (!fromAddress) {
    throw new Error("Failed to derive Tron address from private key.");
  }

  await ensureBandwidthForTransfer(fromAddress);

  const requiredEnergy = await resolveRequiredEnergy(validatedTo, params.energyAmount);
  const { energyRentalRef, useTrxBurn } = await ensureEnergyForTransfer(fromAddress, requiredEnergy);

  let feeLimitSun: number;
  if (useTrxBurn) {
    const trxSun = await getTrxBalanceSun(fromAddress);
    feeLimitSun = Math.max(5_000_000, Math.floor(trxSun * 0.88));
    // eslint-disable-next-line no-console
    console.info(
      `[tron] TRX-burn feeLimit=${(feeLimitSun / SUN_PER_TRX).toFixed(2)} TRX ` +
        `on ${fromAddress} (balance=${(trxSun / SUN_PER_TRX).toFixed(2)} TRX).`
    );
  } else {
    // Final pre-broadcast check (resources can change / Feee can lag).
    let resourcesFinal = await readAccountResources(fromAddress);
    if (resourcesFinal.energyLeft < requiredEnergy) {
      // Avoid a second Feee order right after a successful rent — delegation can lag ~30–60s.
      if (energyRentalRef) {
        // eslint-disable-next-line no-console
        console.info(
          `[tron] Pre-broadcast energy short (${resourcesFinal.energyLeft}/${requiredEnergy}) ` +
            `but Feee order ${energyRentalRef} exists — waiting before another rent...`
        );
        const waited = await waitForOnChainEnergy(fromAddress, requiredEnergy, 40);
        resourcesFinal = { ...resourcesFinal, energyLeft: waited };
      }
    }
    if (resourcesFinal.energyLeft < requiredEnergy) {
      const topup = Math.max(65_000, requiredEnergy - resourcesFinal.energyLeft + 15_000);
      // eslint-disable-next-line no-console
      console.info(
        `[tron] Pre-broadcast energy still short (${resourcesFinal.energyLeft}/${requiredEnergy}); renting ${topup}...`
      );
      const energyTop = await rentTronEnergy(fromAddress, topup);
      if (!energyTop.rented) {
        throw new Error(
          `Aborting transfer: energy ${resourcesFinal.energyLeft} < required ${requiredEnergy} for ${fromAddress}.`
        );
      }
      resourcesFinal = {
        energyLeft: await waitForOnChainEnergy(fromAddress, requiredEnergy),
        bandwidthLeft: resourcesFinal.bandwidthLeft,
      };
    }
    if (resourcesFinal.energyLeft < requiredEnergy) {
      throw new Error(
        `Aborting transfer: energy ${resourcesFinal.energyLeft} < required ${requiredEnergy} for ${fromAddress}. ` +
          `Rent more Feee energy before broadcasting.`
      );
    }
    // Energy is covered by Feee — feeLimit must allow full contract execution (not 3 TRX cap).
    feeLimitSun = FEE_LIMIT_WITH_ENERGY_SUN;
    // eslint-disable-next-line no-console
    console.info(
      `[tron] Broadcasting USDT transfer with energy=${resourcesFinal.energyLeft} ` +
        `feeLimit=${feeLimitSun / SUN_PER_TRX} TRX`
    );
  }

  const txHash = await withTronHostFallback(async (signer) => {
    const contract = await signer.contract().at(env.USDT_CONTRACT_TRC20);
    const result = await contract.transfer(validatedTo, amountRaw.toString()).send({
      feeLimit: feeLimitSun,
      callValue: 0,
      shouldPollResponse: false,
    });

    const hash =
      typeof result === "string"
        ? result
        : result && typeof result === "object"
          ? String(
              (result as { txid?: string; transaction?: { txID?: string } }).txid ??
                (result as { transaction?: { txID?: string } }).transaction?.txID ??
                ""
            )
          : "";

    if (!hash) {
      throw new Error(
        `TRC20 USDT transfer returned unexpected result for ${fromAddress}: ` +
          safeErrorMessage(typeof result === "object" ? JSON.stringify(result) : String(result))
      );
    }

    // Wait up to ~3 minutes for on-chain SUCCESS (Feee energy already spent).
    for (let i = 0; i < 120; i++) {
      try {
        const info = await signer.trx.getTransactionInfo(hash);
        if (info && Object.keys(info).length > 0) {
          const receiptResult = String(
            (info as { receipt?: { result?: string }; result?: string }).receipt?.result ??
              (info as { result?: string }).result ??
              ""
          ).toUpperCase();
          if (receiptResult && receiptResult !== "SUCCESS") {
            throw new Error(
              `TRC20 transfer mined but FAILED on-chain (${receiptResult}). txid=${hash}`
            );
          }
          if (receiptResult === "SUCCESS") {
            return hash;
          }
        }
      } catch (error) {
        if (error instanceof Error && error.message.includes("FAILED on-chain")) {
          throw error;
        }
      }
      await new Promise((resolve) => setTimeout(resolve, 1500));
    }

    throw new Error(
      `TRC20 transfer broadcast (txid=${hash}) but on-chain SUCCESS was not confirmed in time. ` +
        `Check TronScan before retrying.`
    );
  }, normalizedKey);

  return { txHash, energyRentalRef };
}

export async function sweepTronUsdt(params: {
  privateKeyHex: string;
  toAddress: string;
  minHumanAmount: number;
}): Promise<TronSweepResult> {
  const { privateKeyHex, toAddress, minHumanAmount } = params;
  const normalizedKey = normalizePrivateKey(privateKeyHex);
  const fromAddress = createTronWeb(normalizedKey).defaultAddress.base58 as string;
  if (!fromAddress) {
    throw new Error("Failed to derive Tron address from deposit private key.");
  }

  const balance = await getTronUsdtBalance(fromAddress);
  if (balance.raw <= 0n) {
    throw new Error(`No USDT balance on ${fromAddress} (TRC20).`);
  }

  const minRaw = humanUsdtToRawApprox(String(minHumanAmount));
  if (balance.raw < minRaw) {
    throw new Error(
      `USDT balance ${balance.human} on ${fromAddress} is below minimum sweep amount ${minHumanAmount}.`
    );
  }

  const { txHash, energyRentalRef } = await transferTronUsdt({
    privateKeyHex: normalizedKey,
    toAddress,
    amountRaw: balance.raw,
  });

  const bandwidthReclaimTxHash = await reclaimLeftoverTrxToFunder(normalizedKey, fromAddress);

  return {
    sweepTxHash: txHash,
    energyRentalRef,
    bandwidthReclaimTxHash,
    amountHuman: balance.human,
    amountRaw: balance.raw,
  };
}

export async function reclaimSubWalletTrxToFunder(
  subPrivateKeyHex: string,
  fromAddress: string
): Promise<string | undefined> {
  return reclaimLeftoverTrxToFunder(subPrivateKeyHex, fromAddress);
}
