import type { UserDepositAddress } from "@prisma/client";
import { prisma } from "../config/prisma";
import { env } from "../config/env";
import { decryptSecret } from "../utils/secretCipher";
import { safeErrorMessage } from "../utils/chain/common";
import { getEvmUsdtBalance, sweepEvmUsdt } from "../utils/chain/evmUsdt";
import { getTronUsdtBalance, sweepTronUsdt } from "../utils/chain/tronUsdt";
import { assertValidMasterWallet, isValidTronAddress, isValidEvmAddress } from "../utils/walletAddress";
import { ApiError } from "../utils/apiError";
import { toDecimalString } from "../utils/money";
import { creditDetectedOnChainUsdt } from "./deposit.service";
import { DEPOSIT_NETWORKS, type DepositNetwork as DepositNetworkCode } from "../validators/deposit.validator";

export interface SweepRunOptions {
  /** Limit to a single UserDepositAddress row by primary key. */
  depositAddressId?: string;
  /** Limit to a single on-chain deposit address (case-sensitive for Tron). */
  address?: string;
  /** Limit to one network. */
  network?: DepositNetworkCode;
  /** When true, only report balances — never decrypt keys or broadcast txs. */
  dryRun?: boolean;
  /** Bypass the 24h max-failure backoff for this run (CLI/admin testing). */
  force?: boolean;
}

export interface AddressSweepResult {
  depositAddressId: string;
  network: string;
  address: string;
  usdtBalance: string;
  status: "SUCCESS" | "FAILED" | "SKIPPED" | "DRY_RUN";
  sweepTxHash?: string;
  gasTopupTxHash?: string;
  /** Destination master wallet used / that would be used (public address only). */
  masterWallet?: string;
  error?: string;
  linkedClaimsUpdated?: number;
  /** Amount credited to `users.balance` for this successful sweep (if any). */
  balanceCredited?: string;
  /** Ledger `transactions.id` created or reused for this sweep. */
  transactionId?: string;
}

export interface SweepRunSummary {
  scanned: number;
  swept: number;
  skipped: number;
  failed: number;
  dryRun: boolean;
  /** Public master-wallet destinations resolved from env for this run. */
  masterWallets: Partial<Record<DepositNetworkCode, string>>;
  results: AddressSweepResult[];
}

function isDepositNetwork(value: string): value is DepositNetworkCode {
  return (DEPOSIT_NETWORKS as readonly string[]).includes(value);
}

/**
 * Returns the configured admin master wallet for `network`, after hard
 * format validation. Throws (never broadcasts) if the env value is malformed.
 */
export function getMasterWallet(network: DepositNetworkCode): string {
  const raw =
    network === "TRC20"
      ? env.DEPOSIT_WALLET_TRC20
      : network === "BEP20"
        ? env.DEPOSIT_WALLET_BEP20
        : env.DEPOSIT_WALLET_ERC20;

  return assertValidMasterWallet(network, raw);
}

function isPlaceholderEvmWallet(address: string): boolean {
  return /^0x0{40}$/i.test(address.trim());
}

/** Soft check used for dry-run reporting when a wallet may still be a placeholder. */
function peekMasterWallet(network: DepositNetworkCode): { address: string; valid: boolean; error?: string } {
  const raw =
    network === "TRC20"
      ? env.DEPOSIT_WALLET_TRC20
      : network === "BEP20"
        ? env.DEPOSIT_WALLET_BEP20
        : env.DEPOSIT_WALLET_ERC20;

  if (network === "TRC20") {
    return isValidTronAddress(raw)
      ? { address: raw.trim(), valid: true }
      : {
          address: raw.trim(),
          valid: false,
          error: `Invalid DEPOSIT_WALLET_TRC20 "${raw.trim()}": expected Base58Check Tron address starting with 'T'.`,
        };
  }

  if (isPlaceholderEvmWallet(raw) || !isValidEvmAddress(raw)) {
    return {
      address: raw.trim(),
      valid: false,
      error: `DEPOSIT_WALLET_${network} is missing or not a valid non-zero EVM address.`,
    };
  }

  return { address: raw.trim(), valid: true };
}

async function readUsdtBalance(network: DepositNetworkCode, address: string): Promise<string> {
  if (network === "TRC20") {
    const balance = await getTronUsdtBalance(address);
    return balance.human;
  }
  const balance = await getEvmUsdtBalance(network, address);
  return balance.human;
}

/**
 * Tries to acquire a short-lived sweep lock on the address row.
 * Returns false if another worker already holds the lock.
 */
async function tryAcquireSweepLock(addressId: string): Promise<boolean> {
  const now = new Date();
  const lockUntil = new Date(now.getTime() + env.DEPOSIT_SWEEP_LOCK_SECONDS * 1000);

  const result = await prisma.userDepositAddress.updateMany({
    where: {
      id: addressId,
      OR: [{ sweep_lock_until: null }, { sweep_lock_until: { lt: now } }],
    },
    data: { sweep_lock_until: lockUntil },
  });

  return result.count === 1;
}

async function releaseSweepLock(addressId: string): Promise<void> {
  await prisma.userDepositAddress.update({
    where: { id: addressId },
    data: { sweep_lock_until: null },
  });
}

async function countRecentFailures(depositAddressId: string): Promise<number> {
  return prisma.depositSweep.count({
    where: {
      deposit_address_id: depositAddressId,
      status: "FAILED",
      created_at: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) },
    },
  });
}

/**
 * After a successful on-chain sweep: stamp linked APPROVED claims with the
 * sweep hash. Balance was already credited when USDT was detected on the
 * sub-wallet — never credit again here.
 */
async function finalizeSuccessfulSweep(params: {
  depositAddress: UserDepositAddress;
  sweepTxHash: string;
}): Promise<{ linkedClaimsUpdated: number; transactionId: string | null }> {
  const { depositAddress, sweepTxHash } = params;

  return prisma.$transaction(async (tx) => {
    const stamped = await tx.depositRequest.updateMany({
      where: {
        deposit_address_id: depositAddress.id,
        status: "APPROVED",
        sweep_tx_hash: null,
      },
      data: {
        sweep_tx_hash: sweepTxHash,
        swept_at: new Date(),
      },
    });

    // Reject leftover PENDING manual claims (old form path) — never credit them.
    await tx.depositRequest.updateMany({
      where: {
        deposit_address_id: depositAddress.id,
        status: "PENDING",
      },
      data: { status: "REJECTED" },
    });

    const priorCredit = await tx.transaction.findFirst({
      where: {
        user_id: depositAddress.user_id,
        type: "DEPOSIT",
        status: "COMPLETED",
        payment_address: depositAddress.address,
      },
      orderBy: { created_at: "desc" },
      select: { id: true },
    });

    return {
      linkedClaimsUpdated: stamped.count,
      transactionId: priorCredit?.id ?? null,
    };
  });
}

async function persistSweepRecord(params: {
  depositAddress: UserDepositAddress;
  network: DepositNetworkCode;
  amountUsdt: string;
  toAddress: string;
  status: "SUCCESS" | "FAILED" | "SKIPPED";
  attemptCount: number;
  sweepTxHash?: string;
  gasTopupTxHash?: string;
  errorMessage?: string;
}): Promise<void> {
  const {
    depositAddress,
    network,
    amountUsdt,
    toAddress,
    status,
    attemptCount,
    sweepTxHash,
    gasTopupTxHash,
    errorMessage,
  } = params;

  await prisma.$transaction([
    prisma.depositSweep.create({
      data: {
        deposit_address_id: depositAddress.id,
        network,
        amount_usdt: amountUsdt,
        from_address: depositAddress.address,
        to_address: toAddress,
        sweep_tx_hash: sweepTxHash,
        gas_topup_tx_hash: gasTopupTxHash,
        status,
        error_message: errorMessage ? safeErrorMessage(errorMessage) : null,
        attempt_count: attemptCount,
      },
    }),
    prisma.userDepositAddress.update({
      where: { id: depositAddress.id },
      data: {
        last_sweep_status: status,
        last_sweep_tx_hash: sweepTxHash ?? depositAddress.last_sweep_tx_hash,
        last_swept_at: status === "SUCCESS" ? new Date() : depositAddress.last_swept_at,
        sweep_lock_until: null,
      },
    }),
  ]);
}

async function sweepOneAddress(
  depositAddress: UserDepositAddress,
  options: { dryRun: boolean; force?: boolean }
): Promise<AddressSweepResult> {
  const base: AddressSweepResult = {
    depositAddressId: depositAddress.id,
    network: depositAddress.network,
    address: depositAddress.address,
    usdtBalance: "0",
    status: "SKIPPED",
  };

  if (!isDepositNetwork(depositAddress.network)) {
    return { ...base, status: "SKIPPED", error: `Unsupported network "${depositAddress.network}".` };
  }

  const network = depositAddress.network;
  const masterPeek = peekMasterWallet(network);
  base.masterWallet = masterPeek.address;

  if (!options.dryRun && !masterPeek.valid) {
    return {
      ...base,
      status: "SKIPPED",
      error: masterPeek.error ?? `Master wallet DEPOSIT_WALLET_${network} is not configured.`,
    };
  }

  const recentFailures = await countRecentFailures(depositAddress.id);
  if (!options.force && recentFailures >= env.DEPOSIT_SWEEP_MAX_RETRIES) {
    return {
      ...base,
      status: "SKIPPED",
      error: `Address exceeded ${env.DEPOSIT_SWEEP_MAX_RETRIES} failed sweep attempts in the last 24h — skipping until failures age out.`,
    };
  }

  let usdtBalance: string;
  try {
    usdtBalance = await readUsdtBalance(network, depositAddress.address);
  } catch (error) {
    const message = safeErrorMessage(error);
    // eslint-disable-next-line no-console
    console.error(`[sweep] Balance check failed for ${depositAddress.id}: ${message}`);
    return { ...base, status: "FAILED", error: message };
  }

  base.usdtBalance = usdtBalance;

  if (Number(usdtBalance) < env.DEPOSIT_SWEEP_MIN_USDT) {
    return {
      ...base,
      status: "SKIPPED",
      error: `Balance ${usdtBalance} USDT is below minimum ${env.DEPOSIT_SWEEP_MIN_USDT}.`,
    };
  }

  // Credit from on-chain balance BEFORE sweeping (idempotent; never trusts user forms).
  let balanceCredited: string | undefined;
  if (!options.dryRun) {
    try {
      const detection = await creditDetectedOnChainUsdt({
        depositAddressId: depositAddress.id,
        userId: depositAddress.user_id,
        address: depositAddress.address,
        network,
        onChainUsdt: usdtBalance,
      });
      if (detection.credited) {
        balanceCredited = detection.credited;
      }
    } catch (error) {
      const message = safeErrorMessage(error);
      // eslint-disable-next-line no-console
      console.error(`[sweep] On-chain credit failed for ${depositAddress.address}: ${message}`);
      return { ...base, status: "FAILED", error: `On-chain credit failed: ${message}` };
    }
  }

  if (options.dryRun) {
    if (!masterPeek.valid) {
      return {
        ...base,
        status: "SKIPPED",
        error: masterPeek.error ?? `Master wallet DEPOSIT_WALLET_${network} is not configured.`,
      };
    }

    return {
      ...base,
      status: "DRY_RUN",
      masterWallet: masterPeek.address,
      error: `Would credit (if needed) then sweep ${usdtBalance} USDT → ${masterPeek.address} (no broadcast).`,
    };
  }

  // Hard validation immediately before any decrypt / broadcast.
  const toAddress = getMasterWallet(network);
  const locked = await tryAcquireSweepLock(depositAddress.id);
  if (!locked) {
    return {
      ...base,
      status: "SKIPPED",
      balanceCredited,
      error: "Address is currently locked by another sweep attempt.",
    };
  }

  const attemptCount = recentFailures + 1;
  let privateKeyHex: string | undefined;

  try {
    privateKeyHex = decryptSecret(depositAddress.encrypted_private_key);

    const onChain =
      network === "TRC20"
        ? await sweepTronUsdt({
            privateKeyHex,
            toAddress,
            minHumanAmount: env.DEPOSIT_SWEEP_MIN_USDT,
          })
        : await sweepEvmUsdt({
            network,
            privateKeyHex,
            toAddress,
            minHumanAmount: env.DEPOSIT_SWEEP_MIN_USDT,
          });

    // Zero the in-memory key as soon as the broadcast is done.
    privateKeyHex = undefined;

    const settlement = await finalizeSuccessfulSweep({
      depositAddress,
      sweepTxHash: onChain.sweepTxHash,
    });

    const gasRef =
      network === "TRC20" && "energyRentalRef" in onChain
        ? (onChain as { energyRentalRef?: string }).energyRentalRef
        : "gasTopupTxHash" in onChain
          ? (onChain as { gasTopupTxHash?: string }).gasTopupTxHash
          : undefined;

    await persistSweepRecord({
      depositAddress,
      network,
      amountUsdt: onChain.amountHuman,
      toAddress,
      status: "SUCCESS",
      attemptCount,
      sweepTxHash: onChain.sweepTxHash,
      gasTopupTxHash: gasRef,
    });

    // eslint-disable-next-line no-console
    console.log(
      `[sweep] SUCCESS ${network} ${depositAddress.address} amount=${onChain.amountHuman} tx=${onChain.sweepTxHash}` +
        ` credited=${balanceCredited ?? "already-booked"} ledger=${settlement.transactionId}`
    );

    return {
      ...base,
      usdtBalance: onChain.amountHuman,
      status: "SUCCESS",
      masterWallet: toAddress,
      sweepTxHash: onChain.sweepTxHash,
      gasTopupTxHash: gasRef,
      linkedClaimsUpdated: settlement.linkedClaimsUpdated,
      balanceCredited,
      transactionId: settlement.transactionId ?? undefined,
    };
  } catch (error) {
    privateKeyHex = undefined;
    const message = safeErrorMessage(error);

    await persistSweepRecord({
      depositAddress,
      network,
      amountUsdt: usdtBalance,
      toAddress,
      status: "FAILED",
      attemptCount,
      errorMessage: message,
    }).catch((persistError) => {
      // eslint-disable-next-line no-console
      console.error(`[sweep] Failed to persist failure record: ${safeErrorMessage(persistError)}`);
    });

    // eslint-disable-next-line no-console
    console.error(`[sweep] FAILED ${network} ${depositAddress.address}: ${message}`);

    return { ...base, status: "FAILED", error: message };
  } finally {
    await releaseSweepLock(depositAddress.id).catch(() => undefined);
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

/**
 * Scans eligible user deposit addresses and sweeps any with a USDT balance
 * above the configured minimum to the corresponding admin master wallet.
 */
export async function runDepositSweep(options: SweepRunOptions = {}): Promise<SweepRunSummary> {
  const dryRun = options.dryRun === true;

  const where: {
    id?: string;
    network?: string;
    address?: string;
  } = {};

  if (options.depositAddressId) {
    where.id = options.depositAddressId;
  }
  if (options.address) {
    where.address = options.address.trim();
  }
  if (options.network) {
    where.network = options.network;
  }

  const addresses = await prisma.userDepositAddress.findMany({
    where,
    orderBy: { created_at: "asc" },
  });

  if ((options.depositAddressId || options.address) && addresses.length === 0) {
    throw ApiError.notFound("errors.not_found");
  }

  const networksToReport: DepositNetworkCode[] = options.network
    ? [options.network]
    : [...DEPOSIT_NETWORKS];

  const masterWallets: Partial<Record<DepositNetworkCode, string>> = {};
  for (const network of networksToReport) {
    const peek = peekMasterWallet(network);
    if (peek.valid) {
      masterWallets[network] = peek.address;
    }
  }

  // eslint-disable-next-line no-console
  console.log(
    `[sweep] Loaded master wallets from env: ${JSON.stringify(masterWallets)}` +
      ` | Tron RPC: ${env.TRON_FULL_HOST} (fallback ${env.TRON_FALLBACK_HOST})` +
      ` | Tron API key: ${env.TRON_API_KEY ? "configured" : "MISSING"}` +
      ` | Feee energy: ${env.TRON_ENERGY_API_KEY ? "on" : "OFF"}` +
      ` | Bandwidth funder: ${env.TRON_BANDWIDTH_FUNDER_PRIVATE_KEY || env.TRON_BANDWIDTH_FUNDER_MNEMONIC ? "on" : "OFF"}` +
      ` | throttle=${env.DEPOSIT_SWEEP_THROTTLE_MS}ms`
  );

  const results: AddressSweepResult[] = [];
  let swept = 0;
  let skipped = 0;
  let failed = 0;

  for (let index = 0; index < addresses.length; index++) {
    const address = addresses[index];
    const result = await sweepOneAddress(address, { dryRun, force: options.force === true });
    results.push(result);

    if (result.status === "SUCCESS") {
      swept += 1;
    } else if (result.status === "FAILED") {
      failed += 1;
    } else {
      skipped += 1;
    }

    // Throttle between on-chain checks so TronGrid / public RPCs are not hammered.
    if (index < addresses.length - 1 && env.DEPOSIT_SWEEP_THROTTLE_MS > 0) {
      await sleep(env.DEPOSIT_SWEEP_THROTTLE_MS);
    }
  }

  const summary: SweepRunSummary = {
    scanned: addresses.length,
    swept,
    skipped,
    failed,
    dryRun,
    masterWallets,
    results,
  };

  // eslint-disable-next-line no-console
  console.log(
    `[sweep] Run complete. scanned=${summary.scanned} swept=${summary.swept} skipped=${summary.skipped} failed=${summary.failed} dryRun=${dryRun}`
  );

  return summary;
}
