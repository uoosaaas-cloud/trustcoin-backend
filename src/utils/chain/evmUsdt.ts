import { Contract, JsonRpcProvider, Wallet, formatUnits, parseUnits } from "ethers";
import { env } from "../../config/env";
import type { DepositNetwork } from "../../validators/deposit.validator";
import { ensureEvmNativeGas } from "../evmGasFunder";
import { assertValidMasterWallet } from "../walletAddress";
import { ERC20_ABI, safeErrorMessage } from "./common";

export interface EvmUsdtBalance {
  raw: bigint;
  human: string;
  decimals: number;
}

export interface EvmSweepResult {
  sweepTxHash: string;
  gasTopupTxHash?: string;
  amountHuman: string;
  amountRaw: bigint;
}

function getRpcUrl(network: Extract<DepositNetwork, "BEP20" | "ERC20">): string {
  return network === "BEP20" ? env.RPC_URL_BSC : env.RPC_URL_ETH;
}

function getUsdtContract(network: Extract<DepositNetwork, "BEP20" | "ERC20">): string {
  return network === "BEP20" ? env.USDT_CONTRACT_BEP20 : env.USDT_CONTRACT_ERC20;
}

/** BSC USDT peg uses 18 decimals; Ethereum USDT uses 6. */
function getUsdtDecimals(network: Extract<DepositNetwork, "BEP20" | "ERC20">): number {
  return network === "BEP20" ? 18 : 6;
}

function getProvider(network: Extract<DepositNetwork, "BEP20" | "ERC20">): JsonRpcProvider {
  return new JsonRpcProvider(getRpcUrl(network));
}

function humanToRawFloor(human: number, decimals: number): bigint {
  // Avoid float drift for min-amount checks (integer human units only).
  const whole = Math.floor(human);
  return BigInt(whole) * 10n ** BigInt(decimals);
}

export async function getEvmUsdtBalance(
  network: Extract<DepositNetwork, "BEP20" | "ERC20">,
  address: string
): Promise<EvmUsdtBalance> {
  const provider = getProvider(network);
  const decimals = getUsdtDecimals(network);
  const contract = new Contract(getUsdtContract(network), ERC20_ABI, provider);
  const raw = (await contract.balanceOf(address)) as bigint;

  return {
    raw,
    human: formatUnits(raw, decimals),
    decimals,
  };
}

/**
 * Sweeps the entire USDT balance from the deposit key to the master wallet.
 * Auto-tops native gas (BNB/ETH) from the EVM gas funder when needed.
 */
export async function sweepEvmUsdt(params: {
  network: Extract<DepositNetwork, "BEP20" | "ERC20">;
  privateKeyHex: string;
  toAddress: string;
  minHumanAmount: number;
}): Promise<EvmSweepResult> {
  const { network, privateKeyHex, minHumanAmount } = params;
  const toAddress = assertValidMasterWallet(network, params.toAddress);
  const provider = getProvider(network);
  const decimals = getUsdtDecimals(network);
  const wallet = new Wallet(privateKeyHex, provider);
  const contract = new Contract(getUsdtContract(network), ERC20_ABI, wallet);

  const balanceRaw = (await contract.balanceOf(wallet.address)) as bigint;
  const balanceHuman = formatUnits(balanceRaw, decimals);

  if (balanceRaw <= 0n) {
    throw new Error(`No USDT balance on ${wallet.address} (${network}).`);
  }

  const minRaw = humanToRawFloor(minHumanAmount, decimals);
  if (balanceRaw < minRaw) {
    throw new Error(
      `USDT balance ${balanceHuman} on ${wallet.address} is below minimum sweep amount ${minHumanAmount}.`
    );
  }

  let estimatedCostWei: bigint;
  try {
    const gasLimit = await contract.transfer.estimateGas(toAddress, balanceRaw);
    const feeData = await provider.getFeeData();
    const gasPrice = feeData.gasPrice ?? feeData.maxFeePerGas ?? parseUnits("5", "gwei");
    // 20% buffer for fee spikes.
    estimatedCostWei = (gasLimit * gasPrice * 120n) / 100n;
  } catch (error) {
    // eslint-disable-next-line no-console
    console.warn(
      `[evmSweep] Gas estimate failed for ${network}/${wallet.address}: ${safeErrorMessage(error)}`
    );
    estimatedCostWei = parseUnits(network === "BEP20" ? "0.0015" : "0.0008", 18);
  }

  const gasTopupTxHash = await ensureEvmNativeGas(network, wallet.address, estimatedCostWei);

  const tx = await contract.transfer(toAddress, balanceRaw);
  const receipt = await tx.wait(1);

  if (!receipt || receipt.status !== 1) {
    throw new Error(`USDT sweep transaction failed on ${network} (tx=${tx.hash}).`);
  }

  return {
    sweepTxHash: tx.hash,
    gasTopupTxHash,
    amountHuman: balanceHuman,
    amountRaw: balanceRaw,
  };
}
